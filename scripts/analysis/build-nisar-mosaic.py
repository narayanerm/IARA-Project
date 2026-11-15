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
import re
import sys
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

# ---------- Config ----------
ASF_URL = "https://api.daac.asf.alaska.edu/services/search/param"
SEARCH_BBOX = (-66.0, -1.0, -60.5, 5.0)         # slightly beyond TI, so edges get coverage
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
OUTPUT_WIDTH = 2560                               # long-axis pixels (balance quality vs file size)
DOWNLOAD_PARALLEL = 8

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
POLYGON_PATH = PROJECT_ROOT / "public/analysis/data/yanomami-polygon.geojson"
OUTPUT_PNG = PROJECT_ROOT / "public/analysis/data/yanomami-nisar-mosaic.png"
OUTPUT_META = PROJECT_ROOT / "public/analysis/data/yanomami-nisar-mosaic.meta.json"
CACHE_DIR = Path("/tmp/nisar_mosaic_cache")


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
    """Download a small resource with retries + browser User-Agent (CloudFront
    401s the default Python-urllib UA)."""
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
            text = kml_path.read_text()
        elif scene.get("_kml"):
            try:
                data = _retryable_get_bytes(scene["_kml"])
                text = data.decode()
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


def clean_scene(arr):
    """Kill dark-opaque fringe + erode alpha. Returns cleaned RGBA array."""
    rgb_sum = arr[:, :, :3].astype(np.int32).sum(axis=2)
    dark = (arr[:, :, 3] > 0) & (rgb_sum < DARK_RGB_SUM)
    arr[:, :, 3][dark] = 0
    if EDGE_ERODE_PX > 0:
        arr[:, :, 3] = erode_alpha(arr[:, :, 3], EDGE_ERODE_PX)
    return arr


def scene_rgb_stats(arr):
    """Per-channel (mean, std) over valid opaque pixels. None if too few."""
    valid = arr[:, :, 3] == 255
    if valid.sum() < 2000:
        return None
    rgb = arr[:, :, :3][valid].astype(np.float32)
    return rgb.mean(axis=0), rgb.std(axis=0) + 1e-3


def compute_target_stats(paths):
    """Scan every scene once to get a global reference (mean, std) per channel.
    This is what each scene gets rebalanced to before compositing — kills the
    'each ASF browse uses its own min/max' seam problem."""
    print(f"      Scanning {len(paths)} scenes for global color reference…")
    stats = []
    for i, path in enumerate(paths):
        if path is None:
            continue
        try:
            arr = np.array(Image.open(path).convert("RGBA"))
            arr = clean_scene(arr)
            st = scene_rgb_stats(arr)
            if st is not None:
                stats.append(st)
        except Exception:
            pass
        if (i + 1) % 50 == 0:
            print(f"        scanned {i+1}/{len(paths)}")
    if not stats:
        return None, None
    # Median is robust to the occasional pathological scene
    means = np.array([s[0] for s in stats])
    stds = np.array([s[1] for s in stats])
    target_mean = np.median(means, axis=0)
    target_std = np.median(stds, axis=0)
    print(f"      Target RGB mean: {target_mean.round(1).tolist()}, std: {target_std.round(1).tolist()}")
    return target_mean, target_std


def rebalance(arr, target_mean, target_std):
    """Rescale RGB so this scene's per-channel distribution matches the global
    target. Classic Reinhard color transfer, applied per channel. Alpha unchanged."""
    if target_mean is None or target_std is None:
        return arr
    st = scene_rgb_stats(arr)
    if st is None:
        return arr
    src_mean, src_std = st
    rgb = arr[:, :, :3].astype(np.float32)
    rebalanced = (rgb - src_mean) * (target_std / src_std) + target_mean
    rebalanced = np.clip(rebalanced, 0, 255)
    arr[:, :, :3] = rebalanced.astype(np.uint8)
    return arr


def composite(scenes, paths):
    print(f"[4/6] Compositing mosaic")
    target_mean, target_std = compute_target_stats(paths)
    w, s, e, n = TI_BBOX
    lng_span = e - w
    lat_span = n - s
    aspect = lng_span / lat_span
    if aspect >= 1:
        out_w = OUTPUT_WIDTH
        out_h = int(round(OUTPUT_WIDTH / aspect))
    else:
        out_h = OUTPUT_WIDTH
        out_w = int(round(OUTPUT_WIDTH * aspect))
    print(f"      Canvas: {out_w}×{out_h}  (TI bbox {TI_BBOX})")

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
            arr = clean_scene(arr)
            arr = rebalance(arr, target_mean, target_std)
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

            # Alpha-weighted "newest wins": where sub.alpha > 0, overwrite;
            # elsewhere keep what's already there.
            mask = sub_arr[:, :, 3] > 0
            if mask.any():
                slice_out = out[dy:dy_e, dx:dx_e]
                slice_out[mask] = sub_arr[mask]
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
    TI_BBOX = _compute_ti_bbox()
    print(f"[0/6] TI_BBOX from polygon: {tuple(round(v, 3) for v in TI_BBOX)}")

    scenes = search_nisar()
    picked = pick_scenes(scenes)
    fetch_kml_bboxes(picked)
    if not picked:
        print("No scenes to process.", file=sys.stderr)
        sys.exit(1)
    paths = download_all(picked)
    out, out_w, out_h, date_range, drawn = composite(picked, paths)
    out = clip_to_polygon(out, out_w, out_h)
    save(out, drawn, date_range)
    print("\nDone. Reload public/analysis/yanomami-nisar.html to see the mosaic.")


if __name__ == "__main__":
    main()
