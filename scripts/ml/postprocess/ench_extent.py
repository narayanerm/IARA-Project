"""Build the ENCH maximum-flood-extent polygon.

No DEM over the Manaus bbox was downloaded (CHIRPS/SRTM skipped for time). We
build a synthetic maximum-reach polygon by buffering a hand-picked line that
tracks the Rio Negro / Rio Solimões confluence through the city, scaled by the
peak P90 cota predicted for the next 365 days above the 29 m flood stage.

The result is a conservative "worst-case wet envelope": it marks the floodable
corridor the model says is at risk.

Output: /root/ml/outputs/web/ench-flood-extent.geojson with two features:
  - "channel": the river course at normal stage (always wet).
  - "max_flood": the extended corridor that fills during the predicted peak.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import geopandas as gpd
from shapely.geometry import LineString, mapping

OUT = Path("/root/ml/outputs/web/ench-flood-extent.geojson")
FORECAST = Path("/root/ml/outputs/web/ench-flood-forecast.json")

# Rio Negro then Solimões course through the Manaus urban bbox, hand-picked.
RIVER_LINE = [
    (-60.74, -3.10), (-60.65, -3.10), (-60.55, -3.10), (-60.45, -3.09),
    (-60.35, -3.08), (-60.25, -3.05), (-60.15, -3.02), (-60.05, -3.00),
    (-59.95, -3.00), (-59.85, -3.03), (-59.80, -3.10), (-59.75, -3.17),
    (-59.70, -3.23), (-59.60, -3.25), (-59.50, -3.27), (-59.40, -3.27),
    (-59.30, -3.25), (-59.20, -3.23),
]


def main() -> int:
    fc = json.loads(FORECAST.read_text())
    daily = fc["daily"]
    p90_vals = [d["p90"] for d in daily]
    max_p90 = max(p90_vals)
    peak_date = daily[p90_vals.index(max_p90)]["date"]
    flood_stage = 29.0  # m
    delta = max(0.0, max_p90 - flood_stage)
    print(f"[ench-extent] peak P90 {max_p90:.2f} m on {peak_date} · delta over flood = {delta:.2f} m")

    normal = LineString(RIVER_LINE)
    gs = gpd.GeoSeries([normal], crs=4326)
    gs_m = gs.to_crs(3857)

    # Normal channel ≈ 2 km half-width. Flood corridor scales ~1.2 km per metre
    # above flood stage, capped at 4 km extra for a visually honest envelope.
    normal_buf_m = 2000
    extra_m = min(4000, delta * 1200)
    channel = gs_m.buffer(normal_buf_m).to_crs(4326).iloc[0]
    max_flood = gs_m.buffer(normal_buf_m + extra_m).to_crs(4326).iloc[0]
    # Retraction/extent ring = max_flood - channel.
    extent_ring = max_flood.difference(channel)

    channel_km2 = float(gs_m.buffer(normal_buf_m).area.iloc[0] / 1e6)
    flood_km2 = float(gs_m.buffer(normal_buf_m + extra_m).area.iloc[0] / 1e6)
    ring_km2 = flood_km2 - channel_km2
    print(f"[ench-extent] channel={channel_km2:.1f} km² · max_flood={flood_km2:.1f} km² · extra={ring_km2:.1f} km²")

    out_fc = {
        "type": "FeatureCollection",
        "metadata": {
            "model": "ENCH SARIMAX+LSTM forecast · synthetic extent from river line + peak P90",
            "peak_p90_m": round(max_p90, 2),
            "peak_date": peak_date,
            "flood_stage_m": flood_stage,
            "delta_over_flood_m": round(delta, 2),
            "channel_area_km2": round(channel_km2, 2),
            "max_flood_area_km2": round(flood_km2, 2),
            "flood_extent_km2": round(ring_km2, 2),
            "note": "Corridor sintético proporcional ao pico previsto; não substitui DEM.",
        },
        "features": [
            {
                "type": "Feature",
                "properties": {"kind": "channel", "color": "#5AA7C9", "area_km2": channel_km2},
                "geometry": mapping(channel),
            },
            {
                "type": "Feature",
                "properties": {"kind": "max_flood", "color": "#F59E42", "area_km2": ring_km2},
                "geometry": mapping(extent_ring),
            },
        ],
    }
    OUT.write_text(json.dumps(out_fc))
    print(f"[ench-extent] saved {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
