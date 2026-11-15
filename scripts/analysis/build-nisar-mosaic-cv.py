#!/usr/bin/env python3
"""
Build a NISAR L-band mosaic using the OpenCV stitching detail API.

Replaces the "newest wins" raster drop + per-scene percentile rebalance from
build-nisar-mosaic.py with an industry-standard image-stitching pipeline:

  1. Catalog + download (reused from build-nisar-mosaic.py's behavior): ASF
     search → filter DHDH → fetch each _LATLON.png + exact bbox from KML.
  2. Per-scene prep: load BGR+alpha, erode dark antenna-gain fringe, trim
     CROP_EDGE_PX from each side, shrink bbox proportionally.
  3. Project every scene onto the lat/lon canvas: compute pixel corner + size,
     resize BGR + uint8 mask to that rect.
  4. Global exposure compensation via cv2.detail.ExposureCompensator
     (GAIN_BLOCKS variant): solves a least-squares system over ALL overlap
     pairs for a per-scene gain map that minimizes seam intensity differences.
     This is THE fix for the per-channel-percentile color patchwork.
  5. Multi-band blender (Laplacian pyramid, 5 bands) hides any residual seams.
  6. Optional polygon clip, same format as the legacy script.

Output matches the legacy format exactly so the frontend consumers keep working:
  public/analysis/data/<case_stem>-nisar-mosaic.png
  public/analysis/data/<case_stem>-nisar-mosaic.meta.json

Usage: CASE=YANO python3 scripts/analysis/build-nisar-mosaic-cv.py
"""

import json
import netrc
import os
import re
import sys
import time
import urllib.request
import urllib.parse
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

try:
    import requests  # optional: Earthdata Login for authenticated KMLs
except ImportError:
    requests = None


# ---------- Earthdata Login (same mechanism as legacy script) ----------
def _load_edl_token():
    tok = os.environ.get("EDL_TOKEN", "").strip()
    if tok:
        return tok
    p = Path.home() / ".edl_token"
    if p.exists():
        return p.read_text().strip()
    return None


def _build_earthdata_session():
    if requests is None:
        return None
    sess = requests.Session()
    sess.headers.update({"User-Agent": "IARA-mosaic-cv/1.0"})
    token = _load_edl_token()
    if token:
        sess.headers["Authorization"] = f"Bearer {token}"
        print("[auth] Earthdata Login enabled via Bearer token")
        return sess
    try:
        creds = netrc.netrc().authenticators("urs.earthdata.nasa.gov")
    except (FileNotFoundError, netrc.NetrcParseError):
        return None
    if not creds:
        return None
    user, _, pwd = creds
    sess.auth = (user, pwd)
    print(f"[auth] Earthdata Login enabled for {user}")
    return sess


EARTHDATA_SESSION = _build_earthdata_session()


# ---------- Case config (identical to legacy script) ----------
CASE = os.environ.get("CASE", "YANO").upper()
CASES = {
    "YANO": {
        "search_bbox": (-66.0, -1.0, -60.5, 5.0),
        "polygon_file": "yanomami-polygon.geojson",
        "render_bbox": None,
        "out_stem": "yanomami-nisar-mosaic",
    },
    "ENCH": {
        "search_bbox": (-61.0, -3.4, -59.0, -1.75),
        "polygon_file": None,
        "render_bbox": (-60.9, -3.3, -59.1, -1.85),
        "out_stem": "manaus-nisar-mosaic",
    },
    "SECA": {
        "search_bbox": (-61.3, -4.3, -60.1, -3.2),
        "polygon_file": None,
        "render_bbox": (-61.2, -4.2, -60.2, -3.3),
        "out_stem": "manaquiri-nisar-mosaic",
    },
}
if CASE not in CASES:
    print(f"error: unknown CASE={CASE}; choose from {list(CASES)}", file=sys.stderr)
    sys.exit(2)
_CFG = CASES[CASE]

ASF_URL = "https://api.daac.asf.alaska.edu/services/search/param"
SEARCH_BBOX = _CFG["search_bbox"]
NISAR_START = "2025-10-01T00:00:00Z"
PER_CELL = 999
POL_FILTER = "DHDH"
DARK_RGB_SUM = 36
EDGE_ERODE_PX = 1
CROP_EDGE_PX = 96  # aggressive: prefers older neighbor's interior over newer
                   # scene's noisy swath edge (antenna-gain taper). MultiBandBlender
                   # blends what's left — if edges are already dark, blender can't fix it.
LATLON_BUFFER = 0.12
KML_PARALLEL = 6
KML_MAX_RETRIES = 4
HTTP_HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) IARA-mosaic-cv/1.0"}
HTTP_TIMEOUT_S = 20
LAT_SHIFT_DEG = 0.0
LON_SHIFT_DEG = 0.0

TI_BBOX = None
OUTPUT_WIDTH_MAX = 2560
OUTPUT_WIDTH_PER_DEG = 1300
DOWNLOAD_PARALLEL = 8

# Seam finder is optional. GraphCut runs a min-cut on gradient costs and can take
# minutes on >200 scenes with large overlaps. Multi-band blending alone hides
# seams well, so we default to off and let the caller flip it via env.
USE_SEAM_FINDER = os.environ.get("CV_SEAM_FINDER", "1") == "1"
# Compensator: BLOCKS_CHANNELS gives per-channel gain per BLOCK per image, so
# within-scene brightness gradients (antenna-gain fall-off near the swath edge,
# which crop can't fully remove) are corrected locally. Set CV_COMPENSATOR=CHANNELS
# for the lighter global-per-scene variant (fallback if BLOCKS OOMs).
COMP_KIND = os.environ.get("CV_COMPENSATOR", "BLOCKS_CHANNELS").upper()
COMP_BLOCK_SIZE = int(os.environ.get("CV_BLOCK_SIZE", "32"))
# Multi-band blender pyramid depth. 5 = ~32 px blend radius at full res.
BLEND_NUM_BANDS = 5  # 2^5 = 32px low-freq blend radius. Higher values hide dark
                     # seams but create bright halos because darker crop-edge pixels
                     # leak into neighboring interiors through the low-freq band.
                     # 5 + seam finder gives the cleanest tradeoff on NISAR browse PNGs.

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
POLYGON_PATH = (
    PROJECT_ROOT / f"public/analysis/data/{_CFG['polygon_file']}"
    if _CFG["polygon_file"]
    else None
)
OUTPUT_PNG = PROJECT_ROOT / f"public/analysis/data/{_CFG['out_stem']}.png"
OUTPUT_META = PROJECT_ROOT / f"public/analysis/data/{_CFG['out_stem']}.meta.json"
CACHE_DIR = Path(f"/tmp/nisar_mosaic_cache_{CASE.lower()}")


# ---------- TI bbox from polygon (reused) ----------
def _compute_ti_bbox(pad_deg=0.15):
    with open(POLYGON_PATH) as f:
        geo = json.load(f)
    geom = geo["features"][0]["geometry"]
    rings = []
    if geom["type"] == "Polygon":
        rings = [geom["coordinates"][0]]
    elif geom["type"] == "MultiPolygon":
        rings = [poly[0] for poly in geom["coordinates"]]
    all_lons, all_lats = [], []
    for ring in rings:
        for lon, lat in ring:
            all_lons.append(lon)
            all_lats.append(lat)
    return (
        min(all_lons) - pad_deg,
        min(all_lats) - pad_deg,
        max(all_lons) + pad_deg,
        max(all_lats) + pad_deg,
    )


# ---------- Catalog (reused) ----------
def search_nisar():
    print(f"[1/7] Fetching NISAR catalog · bbox={SEARCH_BBOX} since {NISAR_START[:10]}")
    params = {
        "platform": "NISAR",
        "processingLevel": "GCOV",
        "bbox": ",".join(str(x) for x in SEARCH_BBOX),
        "start": NISAR_START,
        "maxResults": 1000,
        "output": "jsonlite",
    }
    url = ASF_URL + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=60) as r:
        data = json.load(r)
    scenes = data.get("results", [])
    print(f"      → {len(scenes)} scenes in catalog")
    return scenes


def parse_wkt_bbox(wkt):
    m = re.match(r"POLYGON\s*\(\((.+?)\)\)", wkt or "")
    if not m:
        return None
    pts = [list(map(float, p.strip().split())) for p in m.group(1).split(",")]
    if not pts:
        return None
    lons = [p[0] for p in pts]
    lats = [p[1] for p in pts]
    w, s, e, n = min(lons), min(lats), max(lons), max(lats)
    cx = (w + e) / 2
    cy = (s + n) / 2
    half_w = (e - w) / 2 * (1 + LATLON_BUFFER)
    half_h = (n - s) / 2 * (1 + LATLON_BUFFER)
    return (cx - half_w, cy - half_h, cx + half_w, cy + half_h)


def pick_scenes(scenes):
    print(f"[2/7] Filter pol={POL_FILTER}, dedupe by (path, frame), top {PER_CELL} newest")
    filtered_pol = 0
    by_cell = {}
    for s in scenes:
        parts = s["granuleName"].split("_")
        pol = parts[9] if len(parts) > 9 else None
        if POL_FILTER and pol != POL_FILTER:
            filtered_pol += 1
            continue
        all_urls = list(s.get("browse") or [])
        all_urls += (s.get("nisar") or {}).get("additionalUrls") or []
        png = next(
            (u for u in all_urls if isinstance(u, str) and u.endswith("_LATLON.png")),
            None,
        )
        kml = next(
            (u for u in all_urls if isinstance(u, str) and u.endswith("_LATLON.kml")),
            None,
        )
        bbox_fallback = parse_wkt_bbox(s.get("wkt"))
        if not png or not bbox_fallback:
            continue
        s["_png"] = png
        s["_kml"] = kml
        s["_bbox"] = bbox_fallback
        key = (s.get("path"), s.get("frame"))
        by_cell.setdefault(key, []).append(s)
    print(f"      filtered out {filtered_pol} non-{POL_FILTER} scenes")

    picked = []
    for bucket in by_cell.values():
        bucket.sort(key=lambda x: x["startTime"], reverse=True)
        picked.extend(bucket[:PER_CELL])
    picked.sort(key=lambda x: x["startTime"])
    print(f"      → {len(by_cell)} unique cells, {len(picked)} scenes picked")
    return picked


# ---------- KML + download (reused) ----------
def _retryable_get_bytes(url):
    if EARTHDATA_SESSION is not None:
        last_err = None
        for attempt in range(KML_MAX_RETRIES):
            try:
                r = EARTHDATA_SESSION.get(url, timeout=HTTP_TIMEOUT_S, allow_redirects=True)
                r.raise_for_status()
                return r.content
            except Exception as e:
                last_err = e
                if attempt < KML_MAX_RETRIES - 1:
                    time.sleep(1.5 * (2 ** attempt))
                    continue
                raise
    last_err = None
    for attempt in range(KML_MAX_RETRIES):
        try:
            req = urllib.request.Request(url, headers=HTTP_HEADERS)
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT_S) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code in (401, 403, 429, 500, 502, 503) and attempt < KML_MAX_RETRIES - 1:
                time.sleep(1.5 * (2 ** attempt))
                continue
            break
        except Exception as e:
            last_err = e
            if attempt < KML_MAX_RETRIES - 1:
                time.sleep(1.0)
                continue
            break
    raise last_err if last_err else RuntimeError("download failed")


def parse_latlon_kml_bbox(text):
    m = re.search(
        r"LatLonQuad[^>]*>\s*<coordinates>\s*([^<]+?)\s*</coordinates>",
        text,
        re.DOTALL,
    )
    if not m:
        return None
    pairs = m.group(1).split()
    coords = []
    for p in pairs:
        parts = p.split(",")
        if len(parts) < 2:
            continue
        try:
            coords.append((float(parts[0]), float(parts[1])))
        except ValueError:
            return None
    if len(coords) < 2:
        return None
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return (min(lons), min(lats), max(lons), max(lats))


def fetch_kml_bboxes(scenes):
    print(f"[2b/7] Fetching exact bbox from LATLON.kml (one per scene)…")
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    def fetch_one(scene):
        name = scene["granuleName"]
        kml_path = CACHE_DIR / f"{name}_LATLON.kml"
        text = None
        if kml_path.exists() and kml_path.stat().st_size > 100:
            cached = kml_path.read_text()
            if cached.lstrip().startswith("<kml") or "LatLonQuad" in cached:
                text = cached
            else:
                kml_path.unlink(missing_ok=True)
        if text is None and scene.get("_kml"):
            try:
                data = _retryable_get_bytes(scene["_kml"])
                text = data.decode()
                if "<kml" not in text[:200] and "LatLonQuad" not in text:
                    return False
                kml_path.write_text(text)
            except Exception:
                return False
        if not text:
            return False
        bbox = parse_latlon_kml_bbox(text)
        if bbox:
            scene["_bbox"] = bbox
            scene["_bbox_from_kml"] = True
            return True
        return False

    done = 0
    got = 0
    with ThreadPoolExecutor(max_workers=KML_PARALLEL) as ex:
        for ok in ex.map(fetch_one, scenes):
            done += 1
            if ok:
                got += 1
            if done % 25 == 0 or done == len(scenes):
                print(f"      {done}/{len(scenes)}  (exact bbox: {got}, WKT fallback: {done - got})")
    print(f"      → exact LATLON bbox for {got}/{len(scenes)} scenes")


def download_one(scene):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    name = scene["granuleName"]
    out = CACHE_DIR / f"{name}.png"
    if out.exists() and out.stat().st_size > 1024:
        return out, True
    try:
        urllib.request.urlretrieve(scene["_png"], out)
        return out, False
    except Exception as e:
        print(f"      ! download fail {name}: {e}")
        return None, False


def download_all(scenes):
    print(f"[3/7] Downloading {len(scenes)} browse PNGs (cache in {CACHE_DIR})")
    paths = [None] * len(scenes)
    done = 0
    cached = 0
    with ThreadPoolExecutor(max_workers=DOWNLOAD_PARALLEL) as ex:
        futures = {ex.submit(download_one, s): i for i, s in enumerate(scenes)}
        for fut in as_completed(futures):
            i = futures[fut]
            path, from_cache = fut.result()
            paths[i] = path
            done += 1
            if from_cache:
                cached += 1
            if done % 25 == 0 or done == len(scenes):
                print(f"      {done}/{len(scenes)}  (cache hits: {cached})")
    ok = sum(1 for p in paths if p)
    print(f"      → {ok} ready, {len(scenes) - ok} failed")
    return paths


# ---------- Per-scene prep ----------
def erode_mask(mask, k):
    """Binary erosion of a uint8 mask by k px using an OpenCV ellipse kernel."""
    if k <= 0:
        return mask
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * k + 1, 2 * k + 1))
    return cv2.erode(mask, kernel, iterations=1)


def crop_edges_bgr(bgr, mask, bbox, k):
    """Trim k px off each side of BOTH raster and mask, shrink bbox proportionally."""
    if k <= 0:
        return bgr, mask, bbox
    h, w = bgr.shape[:2]
    if h <= 2 * k or w <= 2 * k:
        return bgr, mask, bbox
    sw, ss, se, sn = bbox
    px_lon = (se - sw) / w
    px_lat = (sn - ss) / h
    return (
        bgr[k:-k, k:-k].copy(),
        mask[k:-k, k:-k].copy(),
        (sw + k * px_lon, ss + k * px_lat, se - k * px_lon, sn - k * px_lat),
    )


def prepare_scene(path, bbox):
    """Load the browse PNG as BGR, build uint8 mask (255 where usable), kill the
    dark antenna-gain fringe, trim CROP_EDGE_PX, shrink bbox. Returns
    (bgr, mask, cropped_bbox) or (None, None, None) on failure."""
    arr = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if arr is None:
        return None, None, None
    if arr.ndim == 2:
        arr = cv2.cvtColor(arr, cv2.COLOR_GRAY2BGRA)
    if arr.shape[2] == 3:
        alpha = np.full(arr.shape[:2], 255, dtype=np.uint8)
    else:
        alpha = arr[:, :, 3]
    bgr = arr[:, :, :3].copy()
    # Start mask from alpha then kill dark-opaque fringe (RGB sum < DARK_RGB_SUM).
    mask = (alpha > 0).astype(np.uint8) * 255
    rgb_sum = bgr.astype(np.int32).sum(axis=2)
    mask[(mask > 0) & (rgb_sum < DARK_RGB_SUM)] = 0
    mask = erode_mask(mask, EDGE_ERODE_PX)
    bgr, mask, bbox = crop_edges_bgr(bgr, mask, bbox, CROP_EDGE_PX)
    return bgr, mask, bbox


# ---------- Canvas projection ----------
def compute_canvas_size():
    w, s, e, n = TI_BBOX
    lng_span = e - w
    lat_span = n - s
    aspect = lng_span / lat_span
    long_side_deg = max(lng_span, lat_span)
    long_side_px = min(OUTPUT_WIDTH_MAX, int(round(long_side_deg * OUTPUT_WIDTH_PER_DEG)))
    if aspect >= 1:
        out_w = long_side_px
        out_h = int(round(long_side_px / aspect))
    else:
        out_h = long_side_px
        out_w = int(round(long_side_px * aspect))
    return out_w, out_h


def scene_to_canvas_rect(bbox, out_w, out_h):
    """Project a scene bbox onto the canvas. Returns (corner_x, corner_y, w, h)
    clipped to the canvas, or None if no overlap."""
    w, s, e, n = TI_BBOX
    lng_span = e - w
    lat_span = n - s
    sw, ss, se, sn = bbox
    if LAT_SHIFT_DEG or LON_SHIFT_DEG:
        sw += LON_SHIFT_DEG
        se += LON_SHIFT_DEG
        ss += LAT_SHIFT_DEG
        sn += LAT_SHIFT_DEG
    # Clip to canvas bbox first.
    cw = max(sw, w)
    ce = min(se, e)
    cs = max(ss, s)
    cn = min(sn, n)
    if cw >= ce or cs >= cn:
        return None, None
    dx = int(round((cw - w) / lng_span * out_w))
    dx_e = int(round((ce - w) / lng_span * out_w))
    dy = int(round((n - cn) / lat_span * out_h))
    dy_e = int(round((n - cs) / lat_span * out_h))
    if dx_e <= dx or dy_e <= dy:
        return None, None
    rect_w = dx_e - dx
    rect_h = dy_e - dy
    # Source sub-rect in original scene coords (for crop-to-canvas before resize).
    src_h, src_w = None, None  # caller fills
    b_lng = se - sw
    b_lat = sn - ss
    src_rect = (
        (cw - sw) / b_lng,  # x0 fraction
        (sn - cn) / b_lat,  # y0 fraction (flip lat)
        (ce - sw) / b_lng,  # x1 fraction
        (sn - cs) / b_lat,  # y1 fraction
    )
    return (dx, dy, rect_w, rect_h), src_rect


def project_scene(bgr, mask, src_rect_frac, dst_w, dst_h):
    """Crop the scene to its overlap-with-canvas sub-rect (fractional), resize to
    (dst_w, dst_h). src_rect_frac is (x0, y0, x1, y1) in [0,1]."""
    sh, sw = bgr.shape[:2]
    x0 = max(0, int(round(src_rect_frac[0] * sw)))
    y0 = max(0, int(round(src_rect_frac[1] * sh)))
    x1 = min(sw, int(round(src_rect_frac[2] * sw)))
    y1 = min(sh, int(round(src_rect_frac[3] * sh)))
    if x1 <= x0 or y1 <= y0:
        return None, None
    sub_bgr = bgr[y0:y1, x0:x1]
    sub_mask = mask[y0:y1, x0:x1]
    # cv2.resize wants (width, height).
    sub_bgr = cv2.resize(sub_bgr, (dst_w, dst_h), interpolation=cv2.INTER_AREA)
    sub_mask = cv2.resize(sub_mask, (dst_w, dst_h), interpolation=cv2.INTER_NEAREST)
    return sub_bgr, sub_mask


# ---------- OpenCV stitching detail pipeline ----------
# Target pixel area for the compensator feed step. Below ~0.1 MP per scene the
# compensator's pairwise overlap matching stays well inside RAM even for ~200
# scenes. cv2.Stitcher's default seam_megapix is 0.1 MP; we mirror that.
COMP_MEGAPIX = 0.1


def _pick_comp_scale(sizes):
    """Pick a single scale factor so the median scene ends up near COMP_MEGAPIX."""
    if not sizes:
        return 1.0
    areas = np.array([w * h for (w, h) in sizes], dtype=np.float64)
    med = float(np.median(areas))
    target_px = COMP_MEGAPIX * 1e6
    if med <= target_px:
        return 1.0
    return float(np.sqrt(target_px / med))


def _downsample_for_comp(images, masks, corners, scale):
    """Build downscaled copies for the exposure compensator. Gains are computed
    on the small versions then applied to the full-res scenes."""
    if scale >= 0.999:
        return images, masks, corners
    small_images = []
    small_masks = []
    small_corners = []
    for img, mask, (cx, cy) in zip(images, masks, corners):
        h, w = img.shape[:2]
        sw = max(1, int(round(w * scale)))
        sh = max(1, int(round(h * scale)))
        small_images.append(cv2.resize(img, (sw, sh), interpolation=cv2.INTER_AREA))
        small_masks.append(cv2.resize(mask, (sw, sh), interpolation=cv2.INTER_NEAREST))
        small_corners.append((int(round(cx * scale)), int(round(cy * scale))))
    return small_images, small_masks, small_corners


def stitch(scenes, paths):
    print("[4/7] OpenCV detail pipeline: prep + project every scene")
    out_w, out_h = compute_canvas_size()
    print(f"      Canvas: {out_w}×{out_h}  (TI bbox {TI_BBOX})")

    images = []       # BGR uint8
    masks = []        # uint8 (0 or 255)
    corners = []      # (x, y) top-left on canvas
    sizes = []        # (w, h)
    kept = []         # scene dicts

    skipped = 0
    for scene, path in zip(scenes, paths):
        if path is None:
            skipped += 1
            continue
        bgr, mask, bbox = prepare_scene(path, scene["_bbox"])
        if bgr is None or bbox is None:
            skipped += 1
            continue
        rect_and_src = scene_to_canvas_rect(bbox, out_w, out_h)
        if rect_and_src is None or rect_and_src[0] is None:
            skipped += 1
            continue
        (dx, dy, rw, rh), src_rect = rect_and_src
        proj_bgr, proj_mask = project_scene(bgr, mask, src_rect, rw, rh)
        if proj_bgr is None or proj_mask is None:
            skipped += 1
            continue
        if int((proj_mask > 0).sum()) < 1000:
            # Too few valid pixels to help blending; discarding keeps the
            # compensator conditioning sane.
            skipped += 1
            continue
        images.append(proj_bgr)
        masks.append(proj_mask)
        corners.append((dx, dy))
        sizes.append((rw, rh))
        kept.append(scene)

    print(f"      → {len(kept)} scenes projected, {skipped} skipped")
    if not kept:
        raise RuntimeError("No scenes projected onto canvas; nothing to stitch.")

    # ------- 5. Exposure compensation -------
    # Solves a global least-squares for per-scene (3-channel) gains so adjacent
    # scenes agree on intensity across every overlap. This is the fix for the
    # per-channel-percentile color patchwork — the solver sees every pair of
    # overlapping images together, not each scene in isolation.
    #
    # ChannelsCompensator = one scalar gain per BGR channel per image. 3 DoF per
    # image is enough to kill the HH/HV ratio drift between scenes while keeping
    # memory bounded (O(N) vs O(N·blocks²) for GAIN_BLOCKS, which OOMs at ~191
    # scenes on a 2560-wide canvas).
    #
    # We also downscale the inputs fed to the compensator (industry-standard
    # trick, same as cv2.Stitcher at seam_megapix=0.1): gains are computed on
    # ~1/N-scale proxies then applied to the full-res scenes.
    print(f"[5/7] Exposure compensation ({COMP_KIND}, downsampled feed)…")
    corner_tuples = [tuple(c) for c in corners]
    comp_scale = _pick_comp_scale(sizes)
    print(f"      feed scale: {comp_scale:.3f} (reduces each scene to ~{comp_scale*100:.0f}% size)")
    small_images, small_masks, small_corners = _downsample_for_comp(
        images, masks, corner_tuples, comp_scale
    )
    if COMP_KIND == "BLOCKS_CHANNELS":
        # Per-channel gain per block per image → corrects within-scene gradients
        # (antenna gain fall-off at swath edge) that global ChannelsCompensator leaves
        # as faint darker lines after cropping. Block size in DOWNSAMPLED coords.
        bw = max(8, int(round(COMP_BLOCK_SIZE * comp_scale)))
        bh = bw
        compensator = cv2.detail.BlocksChannelsCompensator(bw, bh, 2)
    else:
        compensator = cv2.detail.ChannelsCompensator()
    try:
        compensator.feed(small_corners, small_images, small_masks)
    except cv2.error as e:
        print(f"      ! {COMP_KIND} failed ({e}); falling back to CHANNELS")
        compensator = cv2.detail.ChannelsCompensator()
        compensator.feed(small_corners, small_images, small_masks)
    for i in range(len(images)):
        compensator.apply(i, corner_tuples[i], images[i], masks[i])

    # ------- 6. (optional) seam finder -------
    if USE_SEAM_FINDER:
        print(f"[5b/7] Graph-cut seam finder (COST_COLOR_GRAD)…")
        try:
            seam_finder = cv2.detail.GraphCutSeamFinder("COST_COLOR_GRAD")
            # GraphCutSeamFinder needs float32 images.
            imgs_f = [img.astype(np.float32) / 255.0 for img in images]
            masks = seam_finder.find(imgs_f, corner_tuples, masks)
            masks = [np.asarray(m, dtype=np.uint8) for m in masks]
        except Exception as e:
            print(f"      ! seam finder failed ({e}); keeping original masks")

    # ------- 7. Multi-band blender -------
    print(f"[6/7] Multi-band blender (num_bands={BLEND_NUM_BANDS})…")
    # cv2 5.0 wants int for try_gpu (not bool).
    blender = cv2.detail.MultiBandBlender(0, BLEND_NUM_BANDS)
    blender.prepare((0, 0, out_w, out_h))
    for i, (img, mask, corner) in enumerate(zip(images, masks, corners)):
        blender.feed(img.astype(np.int16), mask, tuple(corner))
        if (i + 1) % 50 == 0 or (i + 1) == len(images):
            print(f"      fed {i+1}/{len(images)}")
    result, result_mask = blender.blend(None, None)
    # blend() returns int16 (signed); clip then cast.
    result = np.clip(result, 0, 255).astype(np.uint8)
    result_mask = np.asarray(result_mask, dtype=np.uint8)

    # Extract date range from scenes actually used.
    dates = sorted(s["startTime"][:10] for s in kept)
    date_range = (dates[0], dates[-1]) if dates else (None, None)

    return result, result_mask, out_w, out_h, date_range, len(kept)


# ---------- Compose RGBA + polygon clip ----------
def to_rgba(bgr, mask):
    """BGR + uint8 mask → RGBA uint8."""
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    h, w = rgb.shape[:2]
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, :3] = rgb
    rgba[:, :, 3] = mask
    return rgba


def clip_to_polygon(out_arr, out_w, out_h):
    print(f"[6b/7] Clipping to polygon ({POLYGON_PATH.name})")
    with open(POLYGON_PATH) as f:
        geo = json.load(f)
    feat = geo["features"][0]
    geom = feat["geometry"]

    w, s, e, n = TI_BBOX
    lng_span = e - w
    lat_span = n - s

    def project(ring):
        return [
            (
                int(round((lng - w) / lng_span * out_w)),
                int(round((n - lat) / lat_span * out_h)),
            )
            for lng, lat in ring
        ]

    if geom["type"] == "Polygon":
        rings = [geom["coordinates"][0]]
    elif geom["type"] == "MultiPolygon":
        rings = [poly[0] for poly in geom["coordinates"]]
    else:
        raise ValueError(f"Unsupported geometry: {geom['type']}")

    mask_img = Image.new("L", (out_w, out_h), 0)
    draw = ImageDraw.Draw(mask_img)
    for ring in rings:
        draw.polygon(project(ring), fill=255)
    mask = np.array(mask_img)

    new_alpha = (out_arr[:, :, 3].astype(np.uint32) * mask // 255).astype(np.uint8)
    out_arr[:, :, 3] = new_alpha
    inside = int((mask > 0).sum())
    print(f"      → {inside/(out_w*out_h)*100:.1f}% of canvas is inside polygon")
    return out_arr


# ---------- Save ----------
def save(out_arr, drawn, date_range):
    OUTPUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    img = Image.fromarray(out_arr, "RGBA")
    img.save(OUTPUT_PNG, optimize=True)
    size_kb = OUTPUT_PNG.stat().st_size / 1024
    print(f"[7/7] Saved {OUTPUT_PNG.relative_to(PROJECT_ROOT)}  ({size_kb:.0f} KB)")

    meta = {
        "bbox": list(TI_BBOX),
        "width": int(out_arr.shape[1]),
        "height": int(out_arr.shape[0]),
        "scenesComposited": drawn,
        "perCell": PER_CELL,
        "dateRange": list(date_range),
        "buildDate": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "NISAR L2 GCOV · NASA/ISRO · ASF DAAC",
        "pipeline": "opencv.detail (GAIN_BLOCKS + MultiBandBlender)",
    }
    with open(OUTPUT_META, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"      Saved {OUTPUT_META.relative_to(PROJECT_ROOT)}")


def main():
    global TI_BBOX
    if POLYGON_PATH:
        TI_BBOX = _compute_ti_bbox()
        print(f"[0/7] TI_BBOX from polygon ({POLYGON_PATH.name}): {tuple(round(v, 3) for v in TI_BBOX)}")
    else:
        TI_BBOX = _CFG["render_bbox"]
        print(f"[0/7] TI_BBOX from case config ({CASE}): {tuple(round(v, 3) for v in TI_BBOX)}")

    scenes = search_nisar()
    picked = pick_scenes(scenes)
    fetch_kml_bboxes(picked)
    if not picked:
        print("No scenes to process.", file=sys.stderr)
        sys.exit(1)
    paths = download_all(picked)

    result_bgr, result_mask, out_w, out_h, date_range, drawn = stitch(picked, paths)
    out_arr = to_rgba(result_bgr, result_mask)

    if POLYGON_PATH:
        out_arr = clip_to_polygon(out_arr, out_w, out_h)
    else:
        print(f"[6b/7] Skipping polygon clip (case={CASE} has no polygon_file)")

    save(out_arr, drawn, date_range)
    print(f"\nDone. Output: {OUTPUT_PNG.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
