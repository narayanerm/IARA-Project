"""Download série diária da cota do Porto de Manaus (ANA 14990000) via SOAP legacy.

Fonte: telemetriaws1.ana.gov.br/serviceana.asmx/HidroSerieHistorica
Cobertura: 1902-presente, sem autenticação.
Saída: scripts/ml/data/raw/ana_14990000_manaus.parquet
"""
from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import pandas as pd
import requests

URL = "https://telemetriaws1.ana.gov.br/serviceana.asmx/HidroSerieHistorica"
STATION = "14990000"
OUT = Path(__file__).resolve().parents[1] / "data/raw/ana_14990000_manaus.parquet"


def _fetch_window(start: str, end: str, nivel: str) -> list[tuple[pd.Timestamp, float, int]]:
    params = {
        "codEstacao": STATION,
        "dataInicio": start,
        "dataFim": end,
        "tipoDados": "1",
        "nivelConsistencia": nivel,
    }
    r = requests.get(URL, params=params, timeout=180)
    r.raise_for_status()
    root = ET.fromstring(r.content)
    rows: list[tuple[pd.Timestamp, float, int]] = []
    for serie in root.iter("SerieHistorica"):
        data_mes = serie.findtext("DataHora")
        nivel_r = int(serie.findtext("NivelConsistencia") or 0)
        if not data_mes:
            continue
        base = pd.to_datetime(data_mes)
        for d in range(1, 32):
            v = serie.findtext(f"Cota{d:02d}")
            if v in (None, ""):
                continue
            try:
                rows.append((base + pd.Timedelta(days=d - 1), float(v) / 100.0, nivel_r))
            except ValueError:
                continue
    return rows


def fetch() -> pd.DataFrame:
    rows: list[tuple[pd.Timestamp, float, int]] = []
    for nivel in ("2", "1"):
        print(f"[ana] fetching nivelConsistencia={nivel}…")
        try:
            w = _fetch_window("01/01/1902", "15/11/2026", nivel)
            print(f"  got {len(w):,} rows")
            rows.extend(w)
        except Exception as err:
            print(f"  WARN {err}")
    df = pd.DataFrame(rows, columns=["date", "level_m", "consistency"])
    df = df.sort_values(["date", "consistency"]).drop_duplicates("date", keep="last")
    return df.reset_index(drop=True)


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    df = fetch()
    df.to_parquet(OUT, index=False)
    print(f"[ana] {len(df):,} rows, {df.date.min().date()} to {df.date.max().date()}")
    print(f"[ana] saved {OUT}")
    print(df.tail(5).to_string(index=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
