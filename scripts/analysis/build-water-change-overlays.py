#!/usr/bin/env python3
"""
Generate sparse "where water tends to rise / where water tends to disappear"
overlays from JRC Global Surface Water transitions (v1.4, 30 m, 1984-2020).

Transitions classes we use:
  Flood (water tends to rise)  → 4 Seasonal, 5 New seasonal, 7 Seasonal→Permanent,
                                 10 Ephemeral seasonal
  Drought (water can disappear) → 3 Lost permanent, 6 Lost seasonal,
                                  8 Permanent→Seasonal, 9 Ephemeral permanent

Outputs RGBA PNGs with transparent background so MapLibre renders them like
RADD alerts (sparse marks stacked over any basemap).

  public/analysis/data/ench-flood-marks.png   + ench-flood-marks.bounds.json
  public/analysis/data/seca-drought-marks.png + seca-drought-marks.bounds.json
"""
import json
import os
from pathlib import Path

import numpy as np
import rasterio
from rasterio.merge import merge
from PIL import Image

os.environ.setdefault("GDAL_HTTP_UNSAFESSL", "YES")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif")

BASE = "/vsicurl/https://storage.googleapis.com/global-surface-water/downloads/transitions"
# Manaus / Manaquiri sit across the 60°W meridian, so we need two 10°x10° tiles.
TILES = [f"{BASE}/transitions_60W_0N.tif", f"{BASE}/transitions_70W_0N.tif"]

OUT = Path(__file__).resolve().parents[2] / "public" / "analysis" / "data"

CASES = [
    {
        "name": "ench-flood",
        "bbox": [-60.9, -3.3, -59.1, -1.85],
        "classes": {4, 5, 7, 10},
        "rgb": (46, 134, 222),  # blue
    },
    {
        "name": "seca-drought",
        "bbox": [-61.2, -4.2, -60.2, -3.3],
        "classes": {3, 6, 8, 9},
        "rgb": (224, 182, 75),  # yellow
    },
]


def build(case):
    w, s, e, n = case["bbox"]
    srcs = [rasterio.open(t) for t in TILES]
    try:
        data, transform = merge(srcs, bounds=(w, s, e, n))
    finally:
        for src in srcs:
            src.close()

    arr = data[0]
    h, wpx = arr.shape

    mask = np.zeros_like(arr, dtype=bool)
    for cls in case["classes"]:
        mask |= arr == cls

    rgba = np.zeros((h, wpx, 4), dtype=np.uint8)
    r, g, b = case["rgb"]
    rgba[mask] = [r, g, b, 230]

    # Compute actual bbox from the output transform (merge may have snapped to pixel grid).
    actual_w = transform.c
    actual_n = transform.f
    actual_e = actual_w + transform.a * wpx
    actual_s = actual_n + transform.e * h
    out_bbox = [actual_w, actual_s, actual_e, actual_n]

    png = OUT / f"{case['name']}-marks.png"
    meta = OUT / f"{case['name']}-marks.bounds.json"
    Image.fromarray(rgba, mode="RGBA").save(png, optimize=True)
    meta.write_text(json.dumps({"bbox": out_bbox}, indent=2))
    n_marked = int(mask.sum())
    pct = 100 * n_marked / (h * wpx)
    print(f"{case['name']}: {png.name} {wpx}x{h}, {n_marked:,} pixels marked ({pct:.2f}%)")


if __name__ == "__main__":
    for c in CASES:
        build(c)
