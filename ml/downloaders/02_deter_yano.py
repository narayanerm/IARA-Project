"""Download DETER-Amz alerts (classe MINERACAO) + MapBiomas Alerta sobre Yanomami.

Target ground truth pro modelo YANO. Dois endpoints WFS sem autenticação.
Saída: scripts/ml/data/raw/deter_mineracao_yano.parquet
       scripts/ml/data/raw/mapbiomas_alerta_yano.parquet
"""
from __future__ import annotations

import sys
from pathlib import Path

import geopandas as gpd

BBOX = (-66.0, -2.0, -62.5, 2.5)
OUT_DIR = Path(__file__).resolve().parents[1] / "data/raw"

DETER_URL = (
    "https://terrabrasilis.dpi.inpe.br/geoserver/deter-amz/wfs"
    "?service=WFS&version=2.0.0&request=GetFeature"
    "&typeName=deter-amz:deter_amz&outputFormat=application/json"
    "&CQL_FILTER=classname=%27MINERACAO%27&srsName=EPSG:4674"
)
MAPB_URL = (
    "https://production.alerta.mapbiomas.org/geoserver/wfs"
    "?service=WFS&version=2.0.0&request=GetFeature"
    "&typeName=mapbiomas-alertas:alert_report&outputFormat=application/json"
    f"&BBOX={BBOX[1]},{BBOX[0]},{BBOX[3]},{BBOX[2]},EPSG:4674&srsName=EPSG:4674"
)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("[deter] GET terrabrasilis MINERACAO…")
    deter = gpd.read_file(DETER_URL)
    deter = deter.cx[BBOX[0]:BBOX[2], BBOX[1]:BBOX[3]].copy()
    date_col = next((c for c in ("view_date", "date", "data") if c in deter.columns), None)
    if date_col is None:
        raise RuntimeError(f"DETER missing date column; got {list(deter.columns)}")
    deter["date"] = gpd.pd.to_datetime(deter[date_col], errors="coerce")
    deter = deter.dropna(subset=["date"])
    deter.to_parquet(OUT_DIR / "deter_mineracao_yano.parquet")
    print(f"[deter] {len(deter):,} polygons, {deter.date.min().date()} to {deter.date.max().date()}")

    print("[mapb] GET mapbiomas alerta…")
    try:
        mapb = gpd.read_file(MAPB_URL)
        mapb.to_parquet(OUT_DIR / "mapbiomas_alerta_yano.parquet")
        print(f"[mapb] {len(mapb):,} polygons")
    except Exception as e:
        print(f"[mapb] WARN failed: {e}; skipping (DETER é target principal)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
