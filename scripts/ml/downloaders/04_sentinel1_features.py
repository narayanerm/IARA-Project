"""Compute Sentinel-1 RTC backscatter stats per pixel for YANO + SECA.

Simple sequential download: pick N=12 scenes evenly across window, download VV+VH
clipped to bbox (via /vsicurl), stack and reduce to percentiles. No threads,
loud errors.

Saída: scripts/ml/data/raw/s1_stats_<case>.tif
"""
from __future__ import annotations

import sys
import traceback
from pathlib import Path

import numpy as np
import planetary_computer as pc
import pystac_client
import rioxarray
import xarray as xr

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"
OUT_DIR = Path(__file__).resolve().parents[1] / "data/raw"

CASES: dict[str, tuple[float, float, float, float]] = {
    "yano": (-66.0, -2.0, -62.5, 2.5),
    "seca": (-61.2, -4.2, -60.2, -3.3),
}
DATERANGE = "2024-11-01/2026-11-15"
N_SCENES = 12
OVERVIEW = 3


def open_asset(href: str, bbox: tuple) -> xr.DataArray | None:
    try:
        da = rioxarray.open_rasterio(href, overview_level=OVERVIEW, masked=True, lock=False)
        da = da.squeeze("band", drop=True)
        da = da.rio.clip_box(*bbox, crs="EPSG:4326")
        return da.load()
    except Exception as e:
        print(f"    FAIL open: {type(e).__name__}: {e}", flush=True)
        return None


def process_case(case: str, bbox: tuple) -> None:
    print(f"=== {case} bbox={bbox} ===", flush=True)
    cat = pystac_client.Client.open(STAC, modifier=pc.sign_inplace)
    search = cat.search(collections=["sentinel-1-rtc"], bbox=bbox, datetime=DATERANGE)
    items = list(search.items())
    print(f"[{case}] {len(items)} RTC items in search", flush=True)
    if not items:
        raise RuntimeError(f"no items for {case}")
    step = max(1, len(items) // N_SCENES)
    items = items[::step][:N_SCENES]
    print(f"[{case}] using {len(items)} scenes, step={step}", flush=True)

    vv_arrays: list[xr.DataArray] = []
    vh_arrays: list[xr.DataArray] = []
    target: xr.DataArray | None = None
    for i, it in enumerate(items):
        print(f"  [{i+1}/{len(items)}] {it.id}", flush=True)
        vv = open_asset(it.assets["vv"].href, bbox)
        vh = open_asset(it.assets["vh"].href, bbox)
        if vv is None or vh is None:
            continue
        if target is None:
            target = vv
            vv_arrays.append(vv)
            vh_arrays.append(vh)
        else:
            try:
                vv_arrays.append(vv.rio.reproject_match(target))
                vh_arrays.append(vh.rio.reproject_match(target))
            except Exception as e:
                print(f"    reproject fail: {e}", flush=True)
    if not vv_arrays:
        raise RuntimeError(f"[{case}] no usable scenes")
    vv_stack = xr.concat(vv_arrays, dim="t")
    vh_stack = xr.concat(vh_arrays, dim="t")
    print(f"[{case}] stacked vv={vv_stack.shape} vh={vh_stack.shape}", flush=True)

    def _q(da, q):
        return (10 * np.log10(10 ** (da / 10)).quantile(q, dim="t")).drop_vars("quantile", errors="ignore")
    bands = xr.Dataset({
        "vv_p50": _q(vv_stack, 0.5),
        "vv_p10": _q(vv_stack, 0.1),
        "vv_p90": _q(vv_stack, 0.9),
        "vh_p50": _q(vh_stack, 0.5),
        "vh_std": vh_stack.std(dim="t"),
    })
    bands = bands.rio.write_crs(target.rio.crs)
    out = OUT_DIR / f"s1_stats_{case}.tif"
    bands.rio.to_raster(out, tiled=True, compress="deflate")
    print(f"[{case}] saved {out}", flush=True)


def main(cases: list[str]) -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for c in cases:
        try:
            process_case(c, CASES[c])
        except Exception:
            print(f"[{c}] FATAL", flush=True)
            traceback.print_exc()
            return 1
    return 0


if __name__ == "__main__":
    targets = sys.argv[1:] or list(CASES.keys())
    sys.exit(main(targets))
