"""Turn the YANO pixel-level risk grid into a clipped GeoJSON overlay.

Pipeline:
  1. Read scripts/ml/outputs/yano_risk_grid.parquet (lon, lat, risk, …).
  2. Keep pixels with risk ≥ 0.7, bucket them into {moderate, high, critical}.
  3. Create ~1.1 km square polygons per pixel.
  4. Clip by the Yanomami polygon so the overlay stays inside the TI.
  5. Dissolve by bucket to shrink the file.
  6. Export public/analysis/data/yano-deforestation-extent.geojson with per-bucket
     area in km² and total deforestation area predicted.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import box

import os
POD = os.environ.get("POD", "0") == "1"
if POD:
    PARQUET = Path("/root/ml/outputs/yano_risk_grid.parquet")
    PERIMETER = Path("/root/ml/data/perimeter/yanomami.geojson")
    OUT = Path("/root/ml/outputs/web/yano-deforestation-extent.geojson")
else:
    ROOT = Path(__file__).resolve().parents[2].parent
    PARQUET = ROOT / "scripts/ml/outputs/yano_risk_grid.parquet"
    PERIMETER = ROOT / "public/analysis/data/yanomami-polygon.geojson"
    OUT = ROOT / "public/analysis/data/yano-deforestation-extent.geojson"

PIXEL_DEG = 0.01
BUCKETS = [
    ("moderate", 0.70, 0.80, "#E4B23A"),
    ("high", 0.80, 0.90, "#E97A4B"),
    ("critical", 0.90, 1.01, "#D53E4F"),
]


def main() -> int:
    print(f"[yano-extent] reading {PARQUET}")
    df = pd.read_parquet(PARQUET)
    print(f"[yano-extent] {len(df):,} pixels total")

    perim = gpd.read_file(PERIMETER)
    if perim.crs is None:
        perim.set_crs(4326, inplace=True)
    perim = perim.to_crs(4326)
    perim_geom = perim.unary_union

    bucket_feats: list[dict] = []
    stats: list[dict] = []
    for name, lo, hi, color in BUCKETS:
        hit = df[(df["risk"] >= lo) & (df["risk"] < hi)].copy()
        if hit.empty:
            stats.append({"bucket": name, "n_pixels": 0, "area_km2": 0.0, "color": color})
            continue
        half = PIXEL_DEG / 2
        geoms = [
            box(lon - half, lat - half, lon + half, lat + half)
            for lon, lat in zip(hit["lon"].values, hit["lat"].values)
        ]
        gdf = gpd.GeoDataFrame({"risk": hit["risk"].values}, geometry=geoms, crs=4326)
        gdf = gdf.clip(perim_geom)
        if gdf.empty:
            stats.append({"bucket": name, "n_pixels": 0, "area_km2": 0.0, "color": color})
            continue
        dissolved = gdf.dissolve(by=None, aggfunc={"risk": "mean"})
        area_km2 = float(dissolved.to_crs(3857).geometry.area.sum() / 1e6)
        avg_risk = float(hit["risk"].mean())
        feat_geom = dissolved.geometry.iloc[0]
        bucket_feats.append({
            "type": "Feature",
            "properties": {
                "bucket": name,
                "color": color,
                "risk_min": lo,
                "risk_max": hi,
                "risk_mean": avg_risk,
                "n_pixels": int(len(hit)),
                "area_km2": area_km2,
            },
            "geometry": json.loads(gpd.GeoSeries([feat_geom], crs=4326).to_json())["features"][0]["geometry"],
        })
        stats.append({
            "bucket": name, "n_pixels": int(len(hit)),
            "area_km2": round(area_km2, 2), "color": color,
        })
        print(f"[yano-extent] {name}: {len(hit):,} pixels → {area_km2:.1f} km²")

    total_area = sum(s["area_km2"] for s in stats)
    total_pixels = sum(s["n_pixels"] for s in stats)
    print(f"[yano-extent] TOTAL: {total_pixels:,} pixels → {total_area:.1f} km²")

    out_fc = {
        "type": "FeatureCollection",
        "metadata": {
            "model": "YANO XGBoost · Hansen GFC target · 1-year horizon",
            "forecast_year": 2025,
            "total_area_km2": round(total_area, 2),
            "total_hotspot_pixels": total_pixels,
            "clipped_by": "Yanomami Indigenous Land polygon",
            "buckets": stats,
        },
        "features": bucket_feats,
    }
    OUT.write_text(json.dumps(out_fc))
    print(f"[yano-extent] saved {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
