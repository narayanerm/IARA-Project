"""Download NOAA ERSSTv5 Niño 3.4 anomalies + SOI as ENSO features.

Saída: scripts/ml/data/raw/enso_indices.parquet
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

import pandas as pd
import requests

NINO34_URL = "https://psl.noaa.gov/data/correlation/nina34.anom.data"
SOI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/soi"
OUT = Path(__file__).resolve().parents[1] / "data/raw/enso_indices.parquet"


def parse_psl_fwf(url: str, na: float) -> pd.DataFrame:
    txt = requests.get(url, timeout=60).text
    lines = txt.strip().splitlines()
    body: list[str] = []
    for ln in lines:
        parts = ln.split()
        if len(parts) == 13:
            try:
                int(parts[0])
                body.append(ln)
            except ValueError:
                pass
    df = pd.DataFrame([ln.split() for ln in body],
                      columns=["year"] + [f"m{i:02d}" for i in range(1, 13)]).astype(float)
    df = df.melt("year", var_name="month", value_name="value")
    df = df[df["value"] != na].copy()
    df["month"] = df["month"].str[1:].astype(int)
    df["date"] = pd.to_datetime(dict(year=df.year.astype(int), month=df.month, day=1))
    return df[["date", "value"]].sort_values("date").reset_index(drop=True)


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    nino = parse_psl_fwf(NINO34_URL, na=-99.99).rename(columns={"value": "nino34"})
    soi_raw = requests.get(SOI_URL, timeout=60).text
    soi_rows: list[tuple[int, int, float]] = []
    for ln in soi_raw.splitlines():
        parts = ln.split()
        if len(parts) == 13:
            try:
                yr = int(parts[0])
                for m, v in enumerate(parts[1:], start=1):
                    fv = float(v)
                    if fv > -990:
                        soi_rows.append((yr, m, fv))
            except ValueError:
                pass
    soi = pd.DataFrame(soi_rows, columns=["year", "month", "soi"])
    soi["date"] = pd.to_datetime(dict(year=soi.year, month=soi.month, day=1))
    soi = soi[["date", "soi"]].sort_values("date").reset_index(drop=True)
    merged = pd.merge(nino, soi, on="date", how="outer").sort_values("date")
    merged.to_parquet(OUT, index=False)
    print(f"[enso] {len(merged):,} rows, {merged.date.min().date()} to {merged.date.max().date()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
