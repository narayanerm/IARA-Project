"""SECA — community-isolation risk from drought (logistic + Monte Carlo).

Pipeline:
  1. Load Rio Negro level from ANA 14990000 (shared with ENCH).
  2. Load ENCH forecast (P10/P50/P90) as input distribution.
  3. Historical isolation labels:
     - 2023 drought: cota < 13.5 m at Manaus proxy → confirmed isolation events.
     - 2024 extreme drought: cota 12.11 m → 50 days isolation.
     - We synthesize labels from historical minima + Civil Defense thresholds
       because the ribeirinho timeline in cases.ts gives explicit community cutoffs.
  4. Logistic regression P(isolated|cota, month, community) fit on 1962-2024.
  5. Monte Carlo n=2000 propagates ENCH forecast band → distribution of
     isolated-days for each community over next 365 days.

Outputs:
  scripts/ml/outputs/seca_metrics.json
  public/analysis/data/seca-isolation-forecast.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import norm
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/raw"
OUT = ROOT / "outputs"
WEB = ROOT / "outputs/web"

COMMUNITIES = [
    {"id": "andiroba",    "name": "Andiroba",    "quantile": 0.20, "pop": 110},
    {"id": "jutai",       "name": "Jutaí",       "quantile": 0.10, "pop": 215},
    {"id": "barro_alto",  "name": "Barro Alto",  "quantile": 0.05, "pop": 190},
    {"id": "janauaca",    "name": "Janauacá",    "quantile": 0.02, "pop": 320},
]
N_MC = 2000


def load_gauge() -> pd.Series:
    df = pd.read_parquet(RAW / "ana_14990000_manaus.parquet")
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").sort_index()
    s = df["level_m"].astype(float)
    full = pd.date_range(s.index.min(), s.index.max(), freq="D")
    s = s.reindex(full).interpolate("time", limit=30).ffill().bfill()
    return s


def load_ench_forecast() -> pd.DataFrame:
    p = OUT / "ench_forecast.parquet"
    if not p.exists():
        raise FileNotFoundError(
            "ench_forecast.parquet missing — run train_ench.py first")
    df = pd.read_parquet(p)
    df["date"] = pd.to_datetime(df["date"])
    return df


def build_labels(gauge: pd.Series, thr: float) -> pd.DataFrame:
    """Daily binary label: 1 if gauge below threshold AND persisted ≥ 7 days.

    Rationale: a single day below threshold does not isolate a community; we
    want to flag periods that *sustain* low water (ribeirinho mobility collapses
    when the lake dries for a week+).
    """
    low = (gauge < thr).astype(int)
    run = low.rolling(7).sum()
    isolated = (run >= 7).astype(int)
    return isolated


def fit_community(gauge: pd.Series, thr: float) -> tuple[LogisticRegression, dict]:
    df = pd.DataFrame({"level": gauge.values, "date": gauge.index})
    df["y"] = build_labels(gauge, thr).values
    df["month"] = df["date"].dt.month
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)
    df["level_m_thr"] = df["level"] - thr
    df = df.dropna()
    split_date = df["date"].quantile(0.8)
    train = df[df["date"] < split_date]
    test = df[df["date"] >= split_date]
    feats = ["level_m_thr", "month_sin", "month_cos"]
    if train["y"].nunique() < 2:
        return None, {"train": {"n": int(len(train)), "note": "no low-level events in train"},
                      "test": {"n": int(len(test)), "note": "skipped"}}
    model = LogisticRegression(max_iter=1000, C=1.0, class_weight="balanced")
    model.fit(train[feats], train["y"])
    metrics = {}
    for name, split in (("train", train), ("test", test)):
        if split["y"].nunique() < 2:
            metrics[name] = {"n": int(len(split)),
                             "positives": int(split["y"].sum()),
                             "note": "degenerate"}
            continue
        p = model.predict_proba(split[feats])[:, 1]
        metrics[name] = {
            "n": int(len(split)),
            "positives": int(split["y"].sum()),
            "roc_auc": float(roc_auc_score(split["y"], p)),
            "brier": float(brier_score_loss(split["y"], p)),
            "log_loss": float(log_loss(split["y"], p, labels=[0, 1])),
        }
    return model, metrics


def forecast_community(model: LogisticRegression, forecast: pd.DataFrame, thr: float) -> dict:
    """Monte Carlo propagation of forecast band → isolated-days distribution."""
    sigma = (forecast["p90"].values - forecast["p10"].values) / (2 * norm.ppf(0.9))
    mu = forecast["p50"].values
    rng = np.random.default_rng(42)
    draws = rng.normal(loc=mu[None, :], scale=sigma[None, :], size=(N_MC, len(mu)))
    month = forecast["date"].dt.month.values
    ms = np.sin(2 * np.pi * month / 12)
    mc = np.cos(2 * np.pi * month / 12)
    diff = draws - thr
    n, d = diff.shape
    X = np.stack([diff, np.broadcast_to(ms, (n, d)), np.broadcast_to(mc, (n, d))], axis=-1).reshape(-1, 3)
    prob = model.predict_proba(X)[:, 1].reshape(n, d)
    rolling_runs = np.cumsum(prob > 0.5, axis=1)
    isolated_days_per_draw = (prob > 0.5).sum(axis=1)
    p_isolated_any = float((isolated_days_per_draw > 0).mean())
    p_isolated_month = float((isolated_days_per_draw >= 30).mean())
    days_stats = {
        "p10": float(np.quantile(isolated_days_per_draw, 0.1)),
        "p50": float(np.quantile(isolated_days_per_draw, 0.5)),
        "p90": float(np.quantile(isolated_days_per_draw, 0.9)),
        "mean": float(isolated_days_per_draw.mean()),
    }
    daily_prob = prob.mean(axis=0).tolist()
    daily_prob_hi = np.quantile(prob, 0.9, axis=0).tolist()
    daily_prob_lo = np.quantile(prob, 0.1, axis=0).tolist()
    return {
        "p_isolated_any_day": p_isolated_any,
        "p_isolated_30_days": p_isolated_month,
        "isolated_days": days_stats,
        "daily_probability": [{
            "date": d.strftime("%Y-%m-%d"),
            "p50": p50, "p10": p10, "p90": p90,
        } for d, p50, p10, p90 in zip(forecast["date"], daily_prob, daily_prob_lo, daily_prob_hi)],
    }


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    WEB.mkdir(parents=True, exist_ok=True)
    print("[seca] loading gauge…")
    gauge = load_gauge()
    print(f"[seca] gauge {len(gauge):,} days {gauge.index.min().date()} → {gauge.index.max().date()}")

    forecast = load_ench_forecast()
    print(f"[seca] ENCH forecast {len(forecast)} days")

    report = {"communities": [], "n_mc": N_MC, "generated_at": gauge.index.max().strftime("%Y-%m-%d")}
    all_metrics: dict[str, dict] = {}
    for c in COMMUNITIES:
        thr = float(gauge.quantile(c["quantile"]))
        c_full = {**c, "threshold_m": thr}
        print(f"[seca] fitting {c['id']} q={c['quantile']} → threshold={thr:.2f}m…")
        model, m = fit_community(gauge, thr)
        all_metrics[c["id"]] = m
        print(f"  train: {m.get('train')}; test: {m.get('test')}")
        if model is None:
            entry = {**c_full, "metrics": m}
        else:
            fc = forecast_community(model, forecast, thr)
            entry = {**c_full, "metrics": m, **fc}
        report["communities"].append(entry)

    (OUT / "seca_metrics.json").write_text(json.dumps(all_metrics, indent=2))
    (WEB / "seca-isolation-forecast.json").write_text(json.dumps(report, indent=2))
    print(f"[seca] saved {WEB/'seca-isolation-forecast.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
