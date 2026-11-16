"""Download SRTM 30m DEM for YANO + SECA bboxes via OpenTopography mirror.

The OT S3 mirror (opentopography.s3.sdsc.edu) hosts SRTMGL1 tiles with no auth.
We mosaic the tiles that intersect each bbox using GDAL's VSI S3 driver.

Saída: scripts/ml/data/raw/srtm_<case>.tif
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import rioxarray
import xarray as xr

OUT_DIR = Path(__file__).resolve().parents[1] / "data/raw"

CASES = {
    "yano": (-66.0, -2.0, -62.5, 2.5),
    "seca": (-61.5, -4.3, -60.0, -3.0),
}


def tile_name(lat: int, lon: int) -> str:
    ns = "N" if lat >= 0 else "S"
    ew = "E" if lon >= 0 else "W"
    return f"{ns}{abs(lat):02d}{ew}{abs(lon):03d}.hgt.gz"


def tiles_for(bbox: tuple[float, float, float, float]) -> list[tuple[int, int]]:
    west, south, east, north = bbox
    import math
    lats = range(math.floor(south), math.ceil(north))
    lons = range(math.floor(west), math.ceil(east))
    return [(la, lo) for la in lats for lo in lons]


def fetch_case(case: str, bbox: tuple) -> None:
    os.environ.setdefault("AWS_NO_SIGN_REQUEST", "YES")
    os.environ.setdefault("AWS_S3_ENDPOINT", "opentopography.s3.sdsc.edu")
    tiles = tiles_for(bbox)
    print(f"[srtm:{case}] {len(tiles)} tiles → {tiles}")
    pieces: list[xr.DataArray] = []
    for lat, lon in tiles:
        url = f"/vsis3/raster/SRTM_GL1/SRTM_GL1_srtm/{tile_name(lat, lon)}"
        try:
            da = rioxarray.open_rasterio(url, masked=True).squeeze("band", drop=True)
            pieces.append(da)
        except Exception as e:
            print(f"  skip {tile_name(lat, lon)}: {e}")
    if not pieces:
        raise RuntimeError(f"no SRTM tiles for {case}")
    merged = pieces[0]
    for p in pieces[1:]:
        merged = merged.combine_first(p.rio.reproject_match(merged))
    merged = merged.rio.clip_box(*bbox)
    out = OUT_DIR / f"srtm_{case}.tif"
    merged.rio.to_raster(out, tiled=True, compress="deflate")
    print(f"[srtm:{case}] saved {out} shape={merged.shape}")


def main(cases) -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for c in cases:
        fetch_case(c, CASES[c])
    return 0


if __name__ == "__main__":
    targets = sys.argv[1:] or ["yano", "seca"]
    sys.exit(main(targets))
