#!/usr/bin/env python3
"""
Build a static Yanomami NISAR mosaic PNG from the live ASF Search catalog.

Fetches NISAR GCOV scenes over the TI bbox, dedupes to the top-K most recent
per (path, frame) cell, downloads each _LATLON.png, kills dark-opaque fringe
pixels, composites oldest→newest (newest wins where it has valid data), and
clips the final canvas to the official Yanomami FUNAI polygon.

Outputs:
  public/analysis/data/yanomami-nisar-mosaic.png
  public/analysis/data/yanomami-nisar-mosaic.meta.json

Usage: python3 scripts/analysis/build-nisar-mosaic.py
"""

import json
import netrc
import os
import re
import sys
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter

try:
    import requests  # optional: enables Earthdata Login for authenticated KMLs
except ImportError:
    requests = None

# Earthdata Login session for authenticated KML fetches. Older NISAR processing
# versions (P05023) return HTML login pages for their _LATLON.kml sidecar; with
# a valid Bearer token (env EDL_TOKEN or file ~/.edl_token) or a ~/.netrc entry
# for urs.earthdata.nasa.gov we get the real KML.
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
    sess.headers.update({"User-Agent": "IARA-mosaic-build/1.0"})
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

# ---------- Case config ----------
# CASE env var picks the AOI (default: YANO). Each entry drives the ASF query bbox,
# optional polygon clip, and output filenames.
CASE = os.environ.get("CASE", "YANO").upper()
CASES = {
    "YANO": {
        "search_bbox": (-66.0, -1.0, -60.5, 5.0),
        "polygon_file": "yanomami-polygon.geojson",   # clip canvas to FUNAI polygon
        "render_bbox": None,                           # computed from polygon
        "out_stem": "yanomami-nisar-mosaic",
    },
    "ENCH": {
        # Manaus municipio bbox (IBGE 1302603): -60.80 -3.22 -59.20 -1.95.  Escala
        # ampla igual YANO/SECA — NISAR L-band (~170 m/px) resolve features ribeirinhas
        # (Rio Negro, Solimões, Encontro das Águas, florestas inundáveis) com nitidez.
        "search_bbox": (-61.0, -3.4, -59.0, -1.75),
        "polygon_file": None,
        "render_bbox": (-60.9, -3.3, -59.1, -1.85),
        "out_stem": "manaus-nisar-mosaic",
    },
    "SECA": {
        # Manaquiri municipio (IBGE 1302553) bbox: -61.16 -4.18 -60.18 -3.31.
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

# ---------- Config ----------
ASF_URL = "https://api.daac.asf.alaska.edu/services/search/param"
SEARCH_BBOX = _CFG["search_bbox"]                 # ASF query bbox for this case
NISAR_START = "2025-10-01T00:00:00Z"              # first public NISAR L-band products
PER_CELL = 999                                    # effectively "all scenes" — no dedupe
                                                  # (runs offline, bandwidth is free)
# Filter to one polarization mode. The catalog mixes DHDH (dual HH+HV, false-color
# RGB with HV strong on canopy → greenish) and SHSH (single HH, pure grayscale).
# Compositing both looks inconsistent — black-and-white patches next to green
# ones. Pick DHDH as the dominant mode (~65% of Yanomami catalog).
POL_FILTER = "DHDH"
DARK_RGB_SUM = 36                                 # opaque pixels below this → NODATA
EDGE_ERODE_PX = 1                                 # final alpha erosion radius
CROP_EDGE_PX = 96                                 # trim px off each side of every scene
                                                  # before composite — kills NISAR swath
                                                  # dark fringe without threshold heuristics.
                                                  # Aggressive: prefers an older neighbor's
                                                  # interior pixels over a newer scene's edge
                                                  # pixels (which carry the antenna-gain
                                                  # taper and radiometric noise).
# Color normalization percentiles (robust to bright/dark outliers).
# Each scene is stretched so its LUMINANCE (p_lo, p_hi) matches the global
# median. One scalar gain is applied to all RGB channels together — this
# preserves the HH/HV ratio (the physical color signature of NISAR DHDH false-
# color), which per-channel normalization destroyed.
NORM_PCT = (2.0, 98.0)
# Alpha feathering radius (sigma for gaussian blur on alpha). Smooths the
# scene-to-scene transition so adjacent scenes blend continuously instead of
# hard-switching at the swath edge.
ALPHA_FEATHER_SIGMA = 4.0
# LATLON_BUFFER is now the FALLBACK when KML download fails. Primary path reads
# the exact LATLON bbox from each scene's _LATLON.kml sidecar (~571 bytes each).
LATLON_BUFFER = 0.12
KML_PARALLEL = 6
KML_MAX_RETRIES = 4
# CloudFront 401s default Python-urllib UA as a bot filter. Browser UA works.
HTTP_HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) IARA-mosaic-build/1.0"}
HTTP_TIMEOUT_S = 20
# Manual global registration offset applied to every scene bbox AFTER exact KML
# bbox is loaded. Use when NISAR products (BETA/PROVISIONAL phase) have a
# systematic ground-position error vs trusted basemaps (Sentinel-2 EOX, OSM).
# Measure by picking one river confluence on both basemap and mosaic. Positive
# LAT_SHIFT_DEG moves imagery NORTH; positive LON_SHIFT_DEG moves imagery EAST.
LAT_SHIFT_DEG = 0.0
LON_SHIFT_DEG = 0.0

# Output canvas
# TI_BBOX is computed from the actual FUNAI polygon at script start (see _compute_ti_bbox).
# Hardcoding it caused a ~125 km cut at the southern edge of Yanomami.
TI_BBOX = None                                    # set by _compute_ti_bbox() at main()
# NISAR browse PNGs are ~1965 px over ~3° (~650 px/° source density).  Cap canvas
# at ~1300 px/° (2× source Nyquist) so we don't upsample and blur — small case
# bboxes used to render at 13× source → visibly fuzzy.
OUTPUT_WIDTH_MAX = 2560
OUTPUT_WIDTH_PER_DEG = 1300
DOWNLOAD_PARALLEL = 8

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
POLYGON_PATH = (
    PROJECT_ROOT / f"public/analysis/data/{_CFG['polygon_file']}"
    if _CFG["polygon_file"]
    else None
)
OUTPUT_PNG = PROJECT_ROOT / f"public/analysis/data/{_CFG['out_stem']}.png"
OUTPUT_META = PROJECT_ROOT / f"public/analysis/data/{_CFG['out_stem']}.meta.json"
CACHE_DIR = Path(f"/tmp/nisar_mosaic_cache_{CASE.lower()}")


# ---------- TI bbox from polygon ----------
def _compute_ti_bbox(pad_deg=0.15):
    """Derive the render-extent bbox from the actual FUNAI polygon so the
    canvas matches the true Yanomami outline (+ small context pad)."""
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


# ---------- Catalog ----------
def search_nisar():
    print(f"[1/6] Fetching NISAR catalog · bbox={SEARCH_BBOX} since {NISAR_START[:10]}")
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
    """Return the DATA extent from the WKT polygon, then expand it by LATLON_BUFFER
    to approximate the full LATLON PNG extent (which is ~12% larger per axis than
    the WKT data polygon — the KML LatLonQuad gives an exact figure, but
    downloading 313 KMLs 401s on CloudFront, so we use a constant buffer).

    Not expanding would cause ~0.2° of positional drift between scenes with
    different swath orientations → visible terrain duplication at seams.
    """
    m = re.match(r"POLYGON\s*\(\((.+?)\)\)", wkt or "")
    if not m:
        return None
    pts = [list(map(float, p.strip().split())) for p in m.group(1).split(",")]
    if not pts:
        return None
    lons = [p[0] for p in pts]
    lats = [p[1] for p in pts]
    w, s, e, n = min(lons), min(lats), max(lons), max(lats)
    # Expand around center by LATLON_BUFFER (default 12%)
    cx = (w + e) / 2
    cy = (s + n) / 2
    half_w = (e - w) / 2 * (1 + LATLON_BUFFER)
    half_h = (n - s) / 2 * (1 + LATLON_BUFFER)
    return (cx - half_w, cy - half_h, cx + half_w, cy + half_h)


def pick_scenes(scenes):
    print(f"[2/6] Filter pol={POL_FILTER}, dedupe by (path, frame), top {PER_CELL} newest")
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
        s["_kml"] = kml  # may be None — fallback to WKT bbox
        s["_bbox"] = bbox_fallback
        key = (s.get("path"), s.get("frame"))
        by_cell.setdefault(key, []).append(s)
    print(f"      filtered out {filtered_pol} non-{POL_FILTER} scenes")

    picked = []
    for bucket in by_cell.values():
        bucket.sort(key=lambda x: x["startTime"], reverse=True)
        picked.extend(bucket[:PER_CELL])
    picked.sort(key=lambda x: x["startTime"])  # oldest → newest for composition order
    print(f"      → {len(by_cell)} unique cells, {len(picked)} scenes picked")
    return picked


# ---------- Download ----------
def download_one(scene):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    name = scene["granuleName"]
    out = CACHE_DIR / f"{name}.png"
    if out.exists() and out.stat().st_size > 1024:
        return out, True  # cached
    try:
        urllib.request.urlretrieve(scene["_png"], out)
        return out, False
    except Exception as e:
        print(f"      ! download fail {name}: {e}")
        return None, False


import time


def _retryable_get_bytes(url):
    """Download a small resource with retries. Uses Earthdata Login if a session
    is configured (reads ~/.netrc), else anonymous CloudFront access."""
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
    """L-band _LATLON.kml always has an axis-aligned LatLonQuad. Return (W,S,E,N)."""
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
    """Pre-fetch each scene's LATLON.kml and read its exact axis-aligned bbox.
    This replaces the earlier WKT-bbox-expanded-by-12%-approximation with the
    actual PNG extent → scenes align with each other and with the Sentinel-2
    basemap. KMLs are tiny (~571 B) so total payload is < 200 KB."""
    print(f"[2b/6] Fetching exact bbox from LATLON.kml (one per scene)…")
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    def fetch_one(scene):
        name = scene["granuleName"]
        kml_path = CACHE_DIR / f"{name}_LATLON.kml"
        text = None
        if kml_path.exists() and kml_path.stat().st_size > 100:
            # Reject corrupt cache (previously Earthdata login HTML was saved as .kml,
            # falling through silently to the WKT fallback with ~13 km position error).
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
                    return False  # server returned login HTML or empty response
                kml_path.write_text(text)
            except Exception:
                return False  # will fall back to WKT bbox
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


def download_all(scenes):
    print(f"[3/6] Downloading {len(scenes)} browse PNGs (cache in {CACHE_DIR})")
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
            if done % 10 == 0 or done == len(scenes):
                print(f"      {done}/{len(scenes)}  (cache hits: {cached})")
    ok = sum(1 for p in paths if p)
    print(f"      → {ok} ready, {len(scenes) - ok} failed")
    return paths


# ---------- Composition ----------
def erode_alpha(alpha, k):
    """Binary erosion of alpha mask by k pixels using 4-neighbor shifts."""
    if k <= 0:
        return alpha
    a = alpha
    for _ in range(k):
        shifted = np.minimum.reduce([
            np.pad(a[1:, :], ((0, 1), (0, 0)), constant_values=0),
            np.pad(a[:-1, :], ((1, 0), (0, 0)), constant_values=0),
            np.pad(a[:, 1:], ((0, 0), (0, 1)), constant_values=0),
            np.pad(a[:, :-1], ((0, 0), (1, 0)), constant_values=0),
            a,
        ])
        a = shifted
    return a


def crop_edges(arr, bbox, k):
    """Trim k px off each side and shrink bbox proportionally so geo-alignment stays correct.
    NISAR browse PNGs have a dark antenna-gain fringe at swath edges that no luminance
    threshold catches reliably; cropping the raster + its bbox together is deterministic
    and cheap since passes overlap enough to cover the trimmed strip."""
    if k <= 0:
        return arr, bbox
    h, w = arr.shape[:2]
    if h <= 2 * k or w <= 2 * k:
        return arr, bbox
    sw, ss, se, sn = bbox
    px_lon = (se - sw) / w
    px_lat = (sn - ss) / h
    return arr[k:-k, k:-k], (sw + k * px_lon, ss + k * px_lat, se - k * px_lon, sn - k * px_lat)


def clean_scene(arr):
    """Kill dark-opaque fringe + erode alpha. Returns cleaned RGBA array."""
    rgb_sum = arr[:, :, :3].astype(np.int32).sum(axis=2)
    dark = (arr[:, :, 3] > 0) & (rgb_sum < DARK_RGB_SUM)
    arr[:, :, 3][dark] = 0
    if EDGE_ERODE_PX > 0:
        arr[:, :, 3] = erode_alpha(arr[:, :, 3], EDGE_ERODE_PX)
    return arr


def scene_luma_percentiles(arr):
    """Scalar (p_lo, p_hi) on luminance over valid opaque pixels. None if too few.
    Scalar on luma (not per-channel) is the key: one gain for all 3 channels keeps
    the HH/HV ratio intact, so DHDH false-color scenes don't drift between green-
    dominant and purple-dominant tints after normalization."""
    valid = arr[:, :, 3] == 255
    if valid.sum() < 2000:
        return None
    rgb = arr[:, :, :3][valid].astype(np.float32)
    luma = rgb.mean(axis=1)
    return (
        float(np.percentile(luma, NORM_PCT[0])),
        float(np.percentile(luma, NORM_PCT[1])),
    )


def compute_target_percentiles(paths):
    """Scan every scene to get a global (target_lo, target_hi) luminance reference.
    Scalar — same stretch applied to every scene, preserving per-scene color ratio."""
    print(f"      Scanning {len(paths)} scenes for global luma percentile reference…")
    pairs = []
    for i, path in enumerate(paths):
        if path is None:
            continue
        try:
            arr = np.array(Image.open(path).convert("RGBA"))
            arr = clean_scene(arr)
            p = scene_luma_percentiles(arr)
            if p is not None:
                pairs.append(p)
        except Exception:
            pass
        if (i + 1) % 50 == 0:
            print(f"        scanned {i+1}/{len(paths)}")
    if not pairs:
        return None, None
    los = np.array([p[0] for p in pairs], dtype=np.float32)
    his = np.array([p[1] for p in pairs], dtype=np.float32)
    target_lo = float(np.median(los))
    target_hi = float(np.median(his))
    print(f"      Target luma p{NORM_PCT[0]:.0f}: {target_lo:.1f}, p{NORM_PCT[1]:.0f}: {target_hi:.1f}")
    return target_lo, target_hi


def rebalance(arr, target_lo, target_hi):
    """Apply ONE scalar gain+offset to all 3 RGB channels so scene luminance
    percentiles match the global (target_lo, target_hi). Preserves HH/HV color
    ratio because R/G/B are scaled together, not independently. Alpha unchanged."""
    if target_lo is None or target_hi is None:
        return arr
    p = scene_luma_percentiles(arr)
    if p is None:
        return arr
    src_lo, src_hi = p
    src_range = max(src_hi - src_lo, 1e-3)
    tgt_range = target_hi - target_lo
    scale = tgt_range / src_range
    offset = target_lo - src_lo * scale
    rgb = arr[:, :, :3].astype(np.float32)
    rebalanced = np.clip(rgb * scale + offset, 0, 255)
    arr[:, :, :3] = rebalanced.astype(np.uint8)
    return arr


def composite(scenes, paths):
    print(f"[4/6] Compositing mosaic")
    target_lo, target_hi = compute_target_percentiles(paths)
    w, s, e, n = TI_BBOX
    lng_span = e - w
    lat_span = n - s
    aspect = lng_span / lat_span
    # Canvas matches source density (~1300 px/°) but is clamped so huge bboxes
    # don't produce absurd files. Prevents upsampling-induced blur for small cases.
    long_side_deg = max(lng_span, lat_span)
    long_side_px = min(OUTPUT_WIDTH_MAX, int(round(long_side_deg * OUTPUT_WIDTH_PER_DEG)))
    if aspect >= 1:
        out_w = long_side_px
        out_h = int(round(long_side_px / aspect))
    else:
        out_h = long_side_px
        out_w = int(round(long_side_px * aspect))
    print(f"      Canvas: {out_w}×{out_h}  (TI bbox {TI_BBOX}, {long_side_deg:.2f}° long side)")

    out = np.zeros((out_h, out_w, 4), dtype=np.uint8)

    date_min = None
    date_max = None
    drawn = 0

    for i, (scene, path) in enumerate(zip(scenes, paths)):
        if path is None:
            continue
        try:
            img = Image.open(path).convert("RGBA")
            arr = np.array(img)
            arr, scene["_bbox"] = crop_edges(arr, scene["_bbox"], CROP_EDGE_PX)
            arr = clean_scene(arr)
            arr = rebalance(arr, target_lo, target_hi)
            # Rebalance CAN leave previously-bright pixels looking dark after the
            # linear remap — those were still alpha=255 and now show up as a black
            # fringe along the swath edge. Re-apply the dark→transparent pass +
            # erode AFTER rebalance to catch them.
            arr = clean_scene(arr)

            sw, ss, se, sn = scene["_bbox"]
            # Global registration offset to match a trusted basemap (Sentinel-2).
            if LAT_SHIFT_DEG or LON_SHIFT_DEG:
                sw += LON_SHIFT_DEG
                se += LON_SHIFT_DEG
                ss += LAT_SHIFT_DEG
                sn += LAT_SHIFT_DEG
            # Intersect with TI bbox
            cw = max(sw, w)
            ce = min(se, e)
            cs = max(ss, s)
            cn = min(sn, n)
            if cw >= ce or cs >= cn:
                continue

            src_h, src_w = arr.shape[:2]
            b_lng = se - sw
            b_lat = sn - ss
            sx = int(round((cw - sw) / b_lng * src_w))
            sx_e = int(round((ce - sw) / b_lng * src_w))
            sy = int(round((sn - cn) / b_lat * src_h))
            sy_e = int(round((sn - cs) / b_lat * src_h))
            sub = arr[sy:sy_e, sx:sx_e]
            if sub.size == 0:
                continue

            dx = int(round((cw - w) / lng_span * out_w))
            dx_e = int(round((ce - w) / lng_span * out_w))
            dy = int(round((n - cn) / lat_span * out_h))
            dy_e = int(round((n - cs) / lat_span * out_h))
            if dx_e <= dx or dy_e <= dy:
                continue

            sub_img = Image.fromarray(sub, "RGBA").resize(
                (dx_e - dx, dy_e - dy), Image.LANCZOS
            )
            sub_arr = np.array(sub_img)

            # Feather alpha so adjacent scenes blend continuously instead of
            # hard-switching at the swath edge — kills the visible seam line.
            if ALPHA_FEATHER_SIGMA > 0 and sub_arr.shape[0] > 2 and sub_arr.shape[1] > 2:
                feathered = gaussian_filter(
                    sub_arr[:, :, 3].astype(np.float32), sigma=ALPHA_FEATHER_SIGMA
                )
                sub_arr[:, :, 3] = np.clip(feathered, 0, 255).astype(np.uint8)

            # Alpha-weighted blend: new scene mixes with existing canvas by its own
            # alpha. Replaces the old hard "newest wins" overwrite, which exposed
            # radiometric mismatch at the boundary as a visible line.
            if (sub_arr[:, :, 3] > 0).any():
                slice_out = out[dy:dy_e, dx:dx_e]
                a = sub_arr[:, :, 3:4].astype(np.float32) / 255.0
                sub_rgb = sub_arr[:, :, :3].astype(np.float32)
                dst_rgb = slice_out[:, :, :3].astype(np.float32)
                blended_rgb = sub_rgb * a + dst_rgb * (1.0 - a)
                blended_a = np.maximum(slice_out[:, :, 3], sub_arr[:, :, 3])
                slice_out[:, :, :3] = blended_rgb.astype(np.uint8)
                slice_out[:, :, 3] = blended_a
                out[dy:dy_e, dx:dx_e] = slice_out

            date = scene["startTime"][:10]
            date_min = date if date_min is None or date < date_min else date_min
            date_max = date if date_max is None or date > date_max else date_max
            drawn += 1
            if drawn % 10 == 0:
                print(f"      drew {drawn}/{len(scenes)}")
        except Exception as ex:
            print(f"      ! fail on {scene['granuleName']}: {ex}")

    print(f"      → {drawn} scenes composited")
    return out, out_w, out_h, (date_min, date_max), drawn


# ---------- Polygon mask ----------
def clip_to_polygon(out_arr, out_w, out_h):
    print(f"[5/6] Clipping to Yanomami polygon ({POLYGON_PATH.name})")
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

    # Multiply alpha by mask / 255 (keeps alpha=0 outside polygon)
    new_alpha = (out_arr[:, :, 3].astype(np.uint32) * mask // 255).astype(np.uint8)
    out_arr[:, :, 3] = new_alpha
    inside = int((mask > 0).sum())
    print(f"      → {inside/(out_w*out_h)*100:.1f}% of canvas is inside TI")
    return out_arr


# ---------- Save ----------
def save(out_arr, drawn, date_range):
    OUTPUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    img = Image.fromarray(out_arr, "RGBA")
    img.save(OUTPUT_PNG, optimize=True)
    size_kb = OUTPUT_PNG.stat().st_size / 1024
    print(f"[6/6] Saved {OUTPUT_PNG.relative_to(PROJECT_ROOT)}  ({size_kb:.0f} KB)")

    meta = {
        "bbox": list(TI_BBOX),
        "width": int(out_arr.shape[1]),
        "height": int(out_arr.shape[0]),
        "scenesComposited": drawn,
        "perCell": PER_CELL,
        "dateRange": list(date_range),
        "buildDate": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "NISAR L2 GCOV · NASA/ISRO · ASF DAAC",
    }
    with open(OUTPUT_META, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"      Saved {OUTPUT_META.relative_to(PROJECT_ROOT)}")


def main():
    global TI_BBOX
    if POLYGON_PATH:
        TI_BBOX = _compute_ti_bbox()
        print(f"[0/6] TI_BBOX from polygon ({POLYGON_PATH.name}): {tuple(round(v, 3) for v in TI_BBOX)}")
    else:
        TI_BBOX = _CFG["render_bbox"]
        print(f"[0/6] TI_BBOX from case config ({CASE}): {tuple(round(v, 3) for v in TI_BBOX)}")

    scenes = search_nisar()
    picked = pick_scenes(scenes)
    fetch_kml_bboxes(picked)
    if not picked:
        print("No scenes to process.", file=sys.stderr)
        sys.exit(1)
    paths = download_all(picked)
    out, out_w, out_h, date_range, drawn = composite(picked, paths)
    if POLYGON_PATH:
        out = clip_to_polygon(out, out_w, out_h)
    else:
        print(f"[5/6] Skipping polygon clip (case={CASE} has no polygon_file)")
    save(out, drawn, date_range)
    print(f"\nDone. Output: {OUTPUT_PNG.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
