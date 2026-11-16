"""Download JRC Global Surface Water yearly history tile for SECA bbox.

Pekel et al. (Nature 2016), free, 30m, 1984-2024.
Saída: scripts/ml/data/raw/jrc_yearly_seca.tif
"""
from __future__ import annotations

import sys
from pathlib import Path

import rioxarray

BBOX = (-61.5, -4.3, -60.0, -3.0)
URL = (
    "https://storage.googleapis.com/global-surface-water/downloads2024/"
    "yearlyHistory/yearlyHistory_0W_10S.tif"
)
OUT = Path(__file__).resolve().parents[1] / "data/raw/jrc_yearly_seca.tif"


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    print(f"[jrc] open {URL}")
    da = rioxarray.open_rasterio(URL, chunks={"x": 2048, "y": 2048})
    sub = da.rio.clip_box(*BBOX)
    sub.rio.to_raster(OUT, tiled=True, compress="deflate")
    print(f"[jrc] saved {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
