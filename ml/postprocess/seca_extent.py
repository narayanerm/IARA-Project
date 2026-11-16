"""Build the SECA maximum-drought-retraction polygon from Sentinel-1 VH stats.

Water surfaces are specular in C-band VH, so backscatter collapses below -22 dB.
Across the 12 scenes we computed s1_stats_seca.tif with:
  band 1 vv_p50, 2 vv_p10, 3 vv_p90, 4 vh_p50, 5 vh_std.

Strategy to isolate the ring of lake that retreats during extreme droughts:
  - "wet-maximum water mask" = pixels where vh_p10 (wettest scene) < threshold.
  - "dry-minimum water mask" = pixels where vh_p90 (driest scene) < threshold.
  - Retraction = wet-max ∧ ¬dry-min, i.e., pixels under water during the flood
    but exposed during the drought.

Uses Otsu on VH_p10 to pick the water threshold adaptively.

Output: /root/ml/outputs/web/seca-drought-extent.geojson with:
  - "permanent": always-water polygons (reference)
  - "retraction": the ring that dries out at drought peak
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import rasterio
import rasterio.features
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

OUT = Path("/root/ml/outputs/web/seca-drought-extent.geojson")
IN = Path("/root/ml/data/raw/s1_stats_seca.tif")


def otsu(x: np.ndarray) -> float:
    x = x[np.isfinite(x)]
    if x.size == 0:
        return -22.0
    hist, edges = np.histogram(x, bins=128)
    bin_mids = (edges[:-1] + edges[1:]) / 2
    w = hist / hist.sum()
    mu = (w * bin_mids).cumsum()
    mu_t = mu[-1]
    w_cum = w.cumsum()
    denom = w_cum * (1 - w_cum)
    denom[denom == 0] = 1e-12
    sigma = (mu_t * w_cum - mu) ** 2 / denom
    return float(bin_mids[np.argmax(sigma)])


def polygonize(mask: np.ndarray, transform, src_crs) -> list:
    import geopandas as gpd
    shapes = rasterio.features.shapes(mask.astype(np.uint8), transform=transform, connectivity=8)
    polys = [shape(geom) for geom, val in shapes if val == 1]
    if not polys:
        return []
    gs = gpd.GeoSeries(polys, crs=src_crs).to_crs(4326)
    return list(gs.geometry)


def km2(geoms) -> float:
    import geopandas as gpd
    if not geoms:
        return 0.0
    s = gpd.GeoSeries(geoms, crs=4326)
    return float(s.to_crs(3857).area.sum() / 1e6)


def main() -> int:
    print(f"[seca-extent] reading {IN}")
    with rasterio.open(IN) as src:
        print(f"[seca-extent] bands={src.count} shape=({src.height},{src.width}) crs={src.crs}")
        bands = src.read().astype(np.float32)
        transform = src.transform
        src_crs = src.crs
    # Band order per train_yano loader: vv_p50, vv_p10, vv_p90, vh_p50, vh_std.
    vv_p50 = bands[0]
    vv_p10 = bands[1]
    vv_p90 = bands[2]
    vh_p50 = bands[3]

    # Use vv_p10 (wettest VV) as "flood extent" proxy and vv_p90 (driest VV) as
    # "drought extent" proxy. VV is more sensitive to open water than VH.
    thr_flood = otsu(vv_p10)
    thr_dry = otsu(vv_p90)
    print(f"[seca-extent] vv_p10 Otsu={thr_flood:.2f} dB · vv_p90 Otsu={thr_dry:.2f} dB")

    wet_mask = (vv_p10 < thr_flood) & np.isfinite(vv_p10)
    dry_mask = (vv_p90 < thr_dry) & np.isfinite(vv_p90)
    retraction_mask = wet_mask & (~dry_mask)
    permanent_mask = wet_mask & dry_mask

    print(
        f"[seca-extent] wet_px={int(wet_mask.sum()):,} dry_px={int(dry_mask.sum()):,} "
        f"retraction_px={int(retraction_mask.sum()):,}"
    )

    perm_polys = polygonize(permanent_mask, transform, src_crs)
    ret_polys = polygonize(retraction_mask, transform, src_crs)
    # Merge into one geometry, then simplify. Drops ~2000 fragments → <50 polygons.
    from shapely.ops import unary_union as _uu

    def consolidate(polys, buffer_m):
        if not polys:
            return []
        import geopandas as gpd
        gs = gpd.GeoSeries(polys, crs=4326).to_crs(3857)
        merged = _uu(gs.buffer(buffer_m).values)
        merged = merged.buffer(-buffer_m * 0.8)  # shrink back a bit
        merged = merged.simplify(80)  # 80 m tolerance
        back = gpd.GeoSeries([merged], crs=3857).to_crs(4326).iloc[0]
        if back.geom_type == "MultiPolygon":
            parts = [p for p in back.geoms if p.area > 2e-6]
        else:
            parts = [back]
        return parts

    perm_polys = consolidate(perm_polys, buffer_m=80)
    ret_polys = consolidate(ret_polys, buffer_m=120)

    perm_km2 = km2(perm_polys) if perm_polys else 0.0
    ret_km2 = km2(ret_polys) if ret_polys else 0.0
    print(f"[seca-extent] permanent={perm_km2:.1f} km² · retraction={ret_km2:.1f} km²")

    def feat(polys, kind, color):
        if not polys:
            return None
        return {
            "type": "Feature",
            "properties": {"kind": kind, "color": color, "area_km2": km2(polys)},
            "geometry": mapping(unary_union(polys)),
        }

    features = [f for f in (
        feat(perm_polys, "permanent", "#5AA7C9"),
        feat(ret_polys, "retraction", "#E97A4B"),
    ) if f]

    out_fc = {
        "type": "FeatureCollection",
        "metadata": {
            "model": "SECA · Sentinel-1 VV wet-vs-dry Otsu",
            "wet_threshold_db": thr_flood,
            "dry_threshold_db": thr_dry,
            "permanent_area_km2": round(perm_km2, 2),
            "retraction_area_km2": round(ret_km2, 2),
            "source": "s1_stats_seca.tif (12 Sentinel-1 scenes 2024-11 to 2026-11)",
        },
        "features": features,
    }
    OUT.write_text(json.dumps(out_fc))
    print(f"[seca-extent] saved {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
