#!/usr/bin/env python3
"""
Build a static Yanomami NISAR S-band mosaic from the live ASF catalog.

Key insight: NISAR_L2_PR_GCOV_..._NATIVE_B_HHHH.png is in a LAT/LON-ALIGNED
grid (not a tilted SAR geometry as I originally assumed). The accompanying
LatLonQuad in the KML is a pure axis-aligned rectangle. So compositing the
S-band side-band uses the SAME code path as L-band — just a different PNG
suffix. No perspective warping needed.

Difference from L-band:
  * Pulls `_NATIVE_B_HHHH.png` (S-band HH only) instead of `_LATLON.png`
    (L-band HH + HV combined).
  * Output: public/analysis/data/yanomami-nisar-sband-mosaic.(png|meta.json)

Usage: python3 scripts/analysis/build-nisar-sband-mosaic.py
"""

import json
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

import numpy as np
from PIL import Image, ImageDraw

# ---------- Case config ----------
CASE = os.environ.get("CASE", "YANO").upper()
CASES = {
    "YANO": {
        "search_bbox": (-66.0, -1.0, -60.5, 5.0),
        "polygon_file": "yanomami-polygon.geojson",
        "render_bbox": None,
        "out_stem": "yanomami-nisar-sband-mosaic",
    },
    "ENCH": {
        "search_bbox": (-60.6, -3.5, -59.4, -2.7),
        "polygon_file": None,
        "render_bbox": (-60.4, -3.4, -59.5, -2.8),
        "out_stem": "manaus-nisar-sband-mosaic",
    },
    "SECA": {
        "search_bbox": (-60.9, -3.8, -60.0, -3.0),
        "polygon_file": None,
        "render_bbox": (-60.7, -3.7, -60.1, -3.2),
        "out_stem": "manaquiri-nisar-sband-mosaic",
    },
}
if CASE not in CASES:
    print(f"error: unknown CASE={CASE}; choose from {list(CASES)}", file=sys.stderr)
    sys.exit(2)
_CFG = CASES[CASE]

# ---------- Config ----------
ASF_URL = "https://api.daac.asf.alaska.edu/services/search/param"
SEARCH_BBOX = _CFG["search_bbox"]
NISAR_START = "2025-10-01T00:00:00Z"
PER_CELL = 999
POL_FILTER = "DHDH"
DARK_RGB_SUM = 36
EDGE_ERODE_PX = 1
LATLON_BUFFER = 0.12

HTTP_HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) IARA-mosaic-build/1.0"}
HTTP_TIMEOUT_S = 20
DOWNLOAD_PARALLEL = 6
DOWNLOAD_MAX_RETRIES = 4

TI_BBOX = None  # set at main()
OUTPUT_WIDTH = 2560

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
POLYGON_PATH = (
    PROJECT_ROOT / f"public/analysis/data/{_CFG['polygon_file']}"
    if _CFG["polygon_file"]
    else None
)
OUTPUT_PNG = PROJECT_ROOT / f"public/analysis/data/{_CFG['out_stem']}.png"
OUTPUT_META = PROJECT_ROOT / f"public/analysis/data/{_CFG['out_stem']}.meta.json"
CACHE_DIR = Path(f"/tmp/nisar_sband_cache_{CASE.lower()}")


def _compute_ti_bbox(pad_deg=0.15):
    with open(POLYGON_PATH) as f:
        geo = json.load(f)
    geom = geo["features"][0]["geometry"]
    rings = (
        [geom["coordinates"][0]]
        if geom["type"] == "Polygon"
        else [poly[0] for poly in geom["coordinates"]]
    )
    lons, lats = [], []
    for ring in rings:
        for lon, lat in ring:
            lons.append(lon)
            lats.append(lat)
    return (min(lons) - pad_deg, min(lats) - pad_deg, max(lons) + pad_deg, max(lats) + pad_deg)


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
    """Return the WKT polygon bbox, expanded by LATLON_BUFFER to approximate the
    actual axis-aligned PNG extent. (The LATLON_B KML gives the exact bbox but
    requires Earthdata Login for most PROVISIONAL scenes.)"""
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
            (u for u in all_urls if isinstance(u, str) and u.endswith("_NATIVE_B_HHHH.png")),
            None,
        )
        bbox = parse_wkt_bbox(s.get("wkt"))
        if not png or not bbox:
            continue
        s["_png"] = png
        s["_bbox"] = bbox
        key = (s.get("path"), s.get("frame"))
        by_cell.setdefault(key, []).append(s)
    print(f"      filtered out {filtered_pol} non-{POL_FILTER} scenes")

    picked = []
    for bucket in by_cell.values():
        bucket.sort(key=lambda x: x["startTime"], reverse=True)
        picked.extend(bucket[:PER_CELL])
    picked.sort(key=lambda x: x["startTime"])
    print(f"      → {len(by_cell)} cells, {len(picked)} scenes picked")
    return picked


def _retryable_get(url, out_path):
    last_err = None
    for attempt in range(DOWNLOAD_MAX_RETRIES):
        try:
            req = urllib.request.Request(url, headers=HTTP_HEADERS)
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT_S) as resp:
                data = resp.read()
            out_path.write_bytes(data) if hasattr(out_path, "write_bytes") else open(out_path, "wb").write(data)
            return True
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code in (401, 403, 429, 500, 502, 503) and attempt < DOWNLOAD_MAX_RETRIES - 1:
                time.sleep(1.5 * (2 ** attempt))
                continue
            break
        except Exception as e:
            last_err = e
            if attempt < DOWNLOAD_MAX_RETRIES - 1:
                time.sleep(1.0)
                continue
            break
    raise last_err if last_err else RuntimeError("download failed")


def download_one(scene):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    name = scene["granuleName"]
    out = CACHE_DIR / f"{name}_NATIVE_B_HHHH.png"
    cached = out.exists() and out.stat().st_size > 1024
    if not cached:
        try:
            _retryable_get(scene["_png"], out)
        except Exception as e:
            print(f"      ! download fail {name}: {e}")
            return (None, False)
    return (out, cached)


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


def erode_alpha(alpha, k):
    if k <= 0:
        return alpha
    a = alpha
    for _ in range(k):
        a = np.minimum.reduce([
            np.pad(a[1:, :], ((0, 1), (0, 0)), constant_values=0),
            np.pad(a[:-1, :], ((1, 0), (0, 0)), constant_values=0),
            np.pad(a[:, 1:], ((0, 0), (0, 1)), constant_values=0),
            np.pad(a[:, :-1], ((0, 0), (1, 0)), constant_values=0),
            a,
        ])
    return a


def clean_scene(arr):
    rgb_sum = arr[:, :, :3].astype(np.int32).sum(axis=2)
    dark = (arr[:, :, 3] > 0) & (rgb_sum < DARK_RGB_SUM)
    arr[:, :, 3][dark] = 0
    if EDGE_ERODE_PX > 0:
        arr[:, :, 3] = erode_alpha(arr[:, :, 3], EDGE_ERODE_PX)
    return arr


def scene_rgb_stats(arr):
    valid = arr[:, :, 3] == 255
    if valid.sum() < 2000:
        return None
    rgb = arr[:, :, :3][valid].astype(np.float32)
    return rgb.mean(axis=0), rgb.std(axis=0) + 1e-3


def compute_target_stats(paths):
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
    means = np.array([s[0] for s in stats])
    stds = np.array([s[1] for s in stats])
    target_mean = np.median(means, axis=0)
    target_std = np.median(stds, axis=0)
    print(f"      Target RGB mean: {target_mean.round(1).tolist()}, std: {target_std.round(1).tolist()}")
    return target_mean, target_std


def rebalance(arr, target_mean, target_std):
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
    print(f"      Canvas: {out_w}×{out_h}  (TI bbox {tuple(round(x, 3) for x in TI_BBOX)})")

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
            arr = clean_scene(arr)  # post-rebalance kill

            sw, ss, se, sn = scene["_bbox"]
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
            print(f"      ! fail {scene['granuleName']}: {ex}")

    print(f"      → {drawn} scenes composited")
    return out, out_w, out_h, (date_min, date_max), drawn


def clip_to_polygon(out_arr, out_w, out_h):
    print(f"[5/6] Clipping to Yanomami polygon")
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
    print(f"      → {inside/(out_w*out_h)*100:.1f}% of canvas is inside TI")
    return out_arr


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
        "source": "NISAR L2 GCOV side-band (S) NATIVE_B_HHHH · NASA/ISRO · ASF DAAC",
        "band": "S",
        "polarization": "HH",
        "wavelengthCm": 10,
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
