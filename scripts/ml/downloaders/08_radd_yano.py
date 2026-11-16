"""Download WUR RADD alerts GeoTIFFs for Yanomami bbox.

RADD alerts are the Wageningen University Sentinel-1 radar-derived deforestation
alerts. Pixel encoding (date_conf): val = conf * 10000 + days_since_2014-12-31.
  - conf == 2: low confidence
  - conf == 3: high confidence
  - conf == 4: detection (confirmed by subsequent observations)

Tile grid: 10°×10°, naming <lat>{N|S}_<lon>{E|W} for the top-left corner.
Yanomami bbox [-66, -2, -62.5, 2.5] needs tiles 10N_070W (north half) and
00N_070W (south half).

Saída:
  scripts/ml/data/raw/radd_yano.tif        — mosaicked conf code (int16)
  scripts/ml/data/raw/radd_yano_dates.tif  — mosaicked days_since_2014-12-31 (int16)
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import rioxarray
import xarray as xr

VERSION = "v20261108"
BASE = f"https://gfw-data-lake.s3.amazonaws.com/wur_radd_alerts/{VERSION}/raster/epsg-4326/10/100000/date_conf/geotiff"
BBOX = (-66.0, -2.0, -62.5, 2.5)
TILES = ["10N_070W", "00N_070W"]
OUT_DIR = Path(__file__).resolve().parents[1] / "data/raw"


def fetch_tile(tile_id: str) -> xr.DataArray:
    url = f"{BASE}/{tile_id}.tif"
    print(f"[radd] GET {url}", flush=True)
    da = rioxarray.open_rasterio(url, chunks={"x": 2048, "y": 2048}, masked=False).squeeze("band", drop=True)
    sub = da.rio.clip_box(*BBOX)
    return sub.load()


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    pieces: list[xr.DataArray] = []
    for t in TILES:
        try:
            pieces.append(fetch_tile(t))
        except Exception as e:
            print(f"[radd] FAIL {t}: {type(e).__name__}: {e}", flush=True)
    if not pieces:
        print("[radd] FATAL no tiles", flush=True)
        return 1

    # Mosaic by first-non-zero (zero = no alert)
    target = pieces[0]
    merged = target
    for p in pieces[1:]:
        p_match = p.rio.reproject_match(target)
        merged = xr.where((merged == 0) & (p_match != 0), p_match, merged)
    merged = merged.rio.write_crs(target.rio.crs)

    # Split into conf code + days
    vals = merged.values.astype(np.int32)
    conf = (vals // 10000).astype(np.int16)
    days = (vals % 10000).astype(np.int16)

    conf_da = xr.DataArray(conf, dims=merged.dims, coords=merged.coords).rio.write_crs(target.rio.crs)
    days_da = xr.DataArray(days, dims=merged.dims, coords=merged.coords).rio.write_crs(target.rio.crs)

    conf_out = OUT_DIR / "radd_yano_conf.tif"
    days_out = OUT_DIR / "radd_yano_days.tif"
    conf_da.rio.to_raster(conf_out, tiled=True, compress="deflate")
    days_da.rio.to_raster(days_out, tiled=True, compress="deflate")

    # Summary
    alert_mask = conf >= 2
    print(f"[radd] shape={conf.shape} alert_pixels={alert_mask.sum():,} "
          f"(conf2={int((conf==2).sum()):,}, conf3={int((conf==3).sum()):,}, conf4={int((conf==4).sum()):,})",
          flush=True)
    if alert_mask.any():
        d_min, d_max = int(days[alert_mask].min()), int(days[alert_mask].max())
        print(f"[radd] days range: {d_min} ({_days_to_date(d_min)}) → {d_max} ({_days_to_date(d_max)})",
              flush=True)
    print(f"[radd] saved {conf_out}, {days_out}", flush=True)
    return 0


def _days_to_date(d: int) -> str:
    import datetime as dt
    return (dt.date(2014, 12, 31) + dt.timedelta(days=d)).isoformat()


if __name__ == "__main__":
    sys.exit(main())
