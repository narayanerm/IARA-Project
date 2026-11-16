"""Download Hansen GFC v1.12 lossyear tile para o bbox Yanomami.

Fonte: storage.googleapis.com/earthenginepartners-hansen (sem auth).
Tile 00N_070W cobre latitude 0-10N, longitude 60-70W: inclui Yanomami.
Saída: scripts/ml/data/raw/hansen_lossyear_yano.tif
"""
from __future__ import annotations

import sys
from pathlib import Path

import rioxarray

URL = (
    "https://storage.googleapis.com/earthenginepartners-hansen/"
    "GFC-2024-v1.12/Hansen_GFC-2024-v1.12_lossyear_00N_070W.tif"
)
BBOX = (-66.0, -2.0, -62.5, 2.5)
OUT = Path(__file__).resolve().parents[1] / "data/raw/hansen_lossyear_yano.tif"


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    print(f"[hansen] opening {URL}…")
    da = rioxarray.open_rasterio(URL, chunks={"x": 2048, "y": 2048})
    if BBOX[1] < 0:
        pass
    sub = da.rio.clip_box(*BBOX)
    print(f"[hansen] window {sub.shape}, writing…")
    sub.rio.to_raster(OUT, tiled=True, compress="deflate")
    print(f"[hansen] saved {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
