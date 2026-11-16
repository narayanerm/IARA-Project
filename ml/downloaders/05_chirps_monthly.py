"""Download CHIRPS v2.0 monthly precipitation COGs clipped to the three cases.

CHIRPS monthly is far smaller than daily (~140 time steps 2015-2026 vs ~4000) and
captures the wet/dry seasonality that drives all three cases. Daily can be swapped
later for ENCH if needed.

Fonte: data.chc.ucsb.edu/products/CHIRPS-2.0 (sem auth).
Saída: scripts/ml/data/raw/chirps_monthly_<case>.nc
"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

import numpy as np
import rioxarray
import xarray as xr
from tqdm import tqdm

BASE = "https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_monthly/tifs"
OUT_DIR = Path(__file__).resolve().parents[1] / "data/raw"

CASES = {
    "yano": (-66.0, -2.0, -62.5, 2.5),
    "ench": (-61.5, -3.5, -58.5, -1.5),
    "seca": (-61.5, -4.3, -60.0, -3.0),
    "bacia_negro": (-74.0, -4.5, -58.0, 5.5),
}


def month_iter(start: date, end: date):
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        yield y, m
        m += 1
        if m == 13:
            y += 1
            m = 1


def fetch_case(case: str, bbox: tuple) -> None:
    print(f"=== CHIRPS {case} bbox={bbox} ===")
    arrs: list[xr.DataArray] = []
    dates: list[np.datetime64] = []
    for y, m in tqdm(list(month_iter(date(2015, 1, 1), date(2026, 10, 1))), desc=case):
        url = f"{BASE}/chirps-v2.0.{y:04d}.{m:02d}.tif.gz"
        try:
            vsi = f"/vsigzip//vsicurl/{url}"
            da = rioxarray.open_rasterio(vsi, masked=True).squeeze("band", drop=True)
            da = da.rio.clip_box(*bbox)
            da = da.where(da >= 0)
            arrs.append(da.load())
            dates.append(np.datetime64(f"{y:04d}-{m:02d}-01"))
        except Exception as e:
            print(f"  skip {y}-{m:02d}: {e}")
    if not arrs:
        raise RuntimeError(f"no CHIRPS data for {case}")
    target = arrs[0]
    aligned = [a.rio.reproject_match(target) for a in arrs]
    stack = xr.concat(aligned, dim="time").assign_coords(time=np.array(dates))
    stack.name = "precip_mm"
    out = OUT_DIR / f"chirps_monthly_{case}.nc"
    stack.to_netcdf(out)
    print(f"[chirps:{case}] saved {out} shape={stack.shape}")


def main(cases) -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for c in cases:
        fetch_case(c, CASES[c])
    return 0


if __name__ == "__main__":
    targets = sys.argv[1:] or ["yano", "ench", "seca", "bacia_negro"]
    sys.exit(main(targets))
