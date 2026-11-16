"""ENCH — Rio Negro river-level forecast (SARIMAX baseline + LSTM challenger).

Pipeline:
  1. Load ANA 14990000 daily gauge (1902-2026), fill gaps with interpolation.
  2. Merge ENSO (Niño 3.4, SOI) + CHIRPS basin monthly as exogenous.
  3. Holdout: 2020-01-01 → 2026-11-15.
  4. Baseline: SARIMAX with Fourier (K=6, m=365.25) + ENSO lag(6m).
  5. Challenger: LSTM (365 past days + ENSO → 7/30/365 ahead).
  6. Metrics: RMSE, MAE, NSE, peak-weighted RMSE on 2020-2024 holdout.
  7. Forecast P10/P50/P90 for next 365 days from last observation.

Outputs:
  scripts/ml/outputs/ench_metrics.json
  scripts/ml/outputs/ench_forecast.parquet
  public/analysis/data/ench-flood-forecast.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import xarray as xr
from sklearn.metrics import mean_absolute_error, mean_squared_error
from statsmodels.tsa.statespace.sarimax import SARIMAX

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/raw"
OUT = ROOT / "outputs"
WEB = ROOT / "outputs/web"

HOLDOUT_START = pd.Timestamp("2010-01-01")
FORECAST_DAYS = 365


def nash_sutcliffe(obs: np.ndarray, pred: np.ndarray) -> float:
    obs, pred = np.asarray(obs), np.asarray(pred)
    denom = ((obs - obs.mean()) ** 2).sum()
    if denom == 0:
        return float("nan")
    return float(1 - ((obs - pred) ** 2).sum() / denom)


def peak_rmse(obs: np.ndarray, pred: np.ndarray, p: float = 90) -> float:
    thr = np.nanpercentile(obs, p)
    mask = obs >= thr
    if mask.sum() == 0:
        return float("nan")
    return float(np.sqrt(np.nanmean((obs[mask] - pred[mask]) ** 2)))


def load_gauge() -> pd.Series:
    df = pd.read_parquet(RAW / "ana_14990000_manaus.parquet")
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").sort_index()
    s = df["level_m"].astype(float)
    full = pd.date_range(s.index.min(), s.index.max(), freq="D")
    s = s.reindex(full)
    s = s.interpolate("time", limit=30).ffill().bfill()
    return s


def load_enso(daily_index: pd.DatetimeIndex) -> pd.DataFrame:
    df = pd.read_parquet(RAW / "enso_indices.parquet")
    df["date"] = pd.to_datetime(df["date"])
    df = (df.groupby("date", as_index=True).mean(numeric_only=True)).sort_index()
    df_d = df.resample("D").asfreq().interpolate("time")
    df_d = df_d.reindex(daily_index).ffill().bfill()
    return df_d


def load_chirps_basin(daily_index: pd.DatetimeIndex) -> pd.Series:
    try:
        da = xr.open_dataset(RAW / "chirps_monthly_bacia_negro.nc")["precip_mm"]
        mean = da.mean(["x", "y"]).to_pandas()
    except Exception:
        try:
            da = xr.open_dataset(RAW / "chirps_monthly_ench.nc")["precip_mm"]
            mean = da.mean(["x", "y"]).to_pandas()
        except Exception as e:
            print(f"[ench] no basin CHIRPS ({e}); using zeros")
            return pd.Series(np.zeros(len(daily_index)), index=daily_index)
    mean.index = pd.to_datetime(mean.index)
    daily = mean.resample("D").asfreq().interpolate("time")
    daily = daily.reindex(daily_index).ffill().bfill()
    return daily.rename("chirps_basin")


def fourier_features(idx: pd.DatetimeIndex, K: int = 3) -> np.ndarray:
    t = (idx - idx[0]).days.values.astype(float)
    cols: list[np.ndarray] = []
    for k in range(1, K + 1):
        cols.append(np.sin(2 * np.pi * k * t / 365.25))
        cols.append(np.cos(2 * np.pi * k * t / 365.25))
    return np.stack(cols, axis=1)


def build_exog(idx: pd.DatetimeIndex, enso: pd.DataFrame, chirps: pd.Series) -> np.ndarray:
    nino_lag6 = enso["nino34"].reindex(idx).shift(180).ffill().bfill()
    soi_lag6 = enso["soi"].reindex(idx).shift(180).ffill().bfill()
    fx = fourier_features(idx, K=3)
    X = np.column_stack([
        nino_lag6.values, soi_lag6.values, fx,
    ])
    return X


def fit_sarimax(y_train: pd.Series, X_train: np.ndarray) -> SARIMAX:
    model = SARIMAX(
        y_train, exog=X_train,
        order=(1, 1, 0),
        seasonal_order=(0, 0, 0, 0),
        trend="n",
        enforce_stationarity=False,
        enforce_invertibility=False,
    )
    return model.fit(disp=False, maxiter=50, method="lbfgs")


def run_sarimax(y: pd.Series, X_all: np.ndarray) -> dict:
    mask = y.index < HOLDOUT_START
    y_tr = y[mask]
    X_tr = X_all[mask]
    print(f"[ench/sarimax] fit on {len(y_tr):,} days…")
    res = fit_sarimax(y_tr, X_tr)
    print(f"[ench/sarimax] forecasting holdout…")
    y_ho = y[~mask]
    X_ho = X_all[~mask]
    pred = res.get_forecast(steps=len(y_ho), exog=X_ho)
    mu = pred.predicted_mean.values
    ci = pred.conf_int(alpha=0.2)
    return {
        "obs": y_ho.values, "pred": mu,
        "p10": ci.iloc[:, 0].values, "p90": ci.iloc[:, 1].values,
        "index": y_ho.index, "model": res,
    }


class LSTMForecaster(nn.Module):
    def __init__(self, n_feat: int, hidden: int = 128, layers: int = 2):
        super().__init__()
        self.lstm = nn.LSTM(n_feat, hidden, num_layers=layers, batch_first=True, dropout=0.1)
        self.head = nn.Linear(hidden, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        o, _ = self.lstm(x)
        return self.head(o[:, -1, :]).squeeze(-1)


def make_windows(y: pd.Series, X: np.ndarray, past: int, horizon: int):
    arr_y = y.values.astype(np.float32)
    arr_X = X.astype(np.float32)
    feats = np.column_stack([arr_y.reshape(-1, 1), arr_X])
    xs, ys = [], []
    for i in range(len(arr_y) - past - horizon + 1):
        xs.append(feats[i:i + past])
        ys.append(arr_y[i + past + horizon - 1])
    return np.array(xs), np.array(ys)


def run_lstm(y: pd.Series, X_all: np.ndarray, horizon: int) -> dict:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[ench/lstm:h={horizon}] device={device}")
    past = 365
    mask = y.index < HOLDOUT_START
    y_tr, y_ho = y[mask], y[~mask]
    X_tr, X_ho = X_all[mask], X_all[~mask]
    scaler_mu = float(y_tr.mean())
    scaler_sd = float(y_tr.std() + 1e-6)
    y_tr_n = (y_tr - scaler_mu) / scaler_sd
    y_ho_n = (y_ho - scaler_mu) / scaler_sd

    # Use features scaled by std
    mu_X, sd_X = X_tr.mean(0), X_tr.std(0) + 1e-6
    X_tr_n = (X_tr - mu_X) / sd_X
    X_ho_n = (X_ho - mu_X) / sd_X

    Xtr_w, ytr_w = make_windows(y_tr_n, X_tr_n, past, horizon)
    y_whole = pd.concat([y_tr_n, y_ho_n])
    X_whole = np.vstack([X_tr_n, X_ho_n])
    Xall_w, yall_w = make_windows(y_whole, X_whole, past, horizon)
    n_ho = len(y_ho_n) - horizon + 1
    Xho_w, yho_w = Xall_w[-n_ho:], yall_w[-n_ho:]

    model = LSTMForecaster(n_feat=Xtr_w.shape[-1]).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3)
    loss_fn = nn.HuberLoss()
    Xtr_t = torch.from_numpy(Xtr_w).to(device)
    ytr_t = torch.from_numpy(ytr_w).to(device)
    Xho_t = torch.from_numpy(Xho_w).to(device)

    model.train()
    for epoch in range(30):
        perm = torch.randperm(len(Xtr_t), device=device)
        losses = []
        for i in range(0, len(perm), 512):
            idx = perm[i:i + 512]
            opt.zero_grad()
            p = model(Xtr_t[idx])
            loss = loss_fn(p, ytr_t[idx])
            loss.backward()
            opt.step()
            losses.append(loss.item())
        if epoch % 5 == 0:
            print(f"  epoch {epoch} loss={np.mean(losses):.4f}")

    model.eval()
    with torch.no_grad():
        pred_n = model(Xho_t).cpu().numpy()
    pred = pred_n * scaler_sd + scaler_mu
    obs = yho_w * scaler_sd + scaler_mu
    obs_idx = y_ho.index[horizon - 1: horizon - 1 + len(obs)]
    return {"obs": obs, "pred": pred, "index": obs_idx, "model": model,
            "scaler": (scaler_mu, scaler_sd), "x_scaler": (mu_X, sd_X), "past": past}


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    WEB.mkdir(parents=True, exist_ok=True)
    print("[ench] loading gauge…")
    y = load_gauge()
    print(f"[ench] gauge: {len(y):,} days {y.index.min().date()} → {y.index.max().date()}")
    print("[ench] loading enso + chirps basin…")
    enso = load_enso(y.index)
    chirps = load_chirps_basin(y.index)
    X_all = build_exog(y.index, enso, chirps)
    print(f"[ench] exog features: {X_all.shape}")

    sarimax = run_sarimax(y, X_all)
    rmse = float(np.sqrt(mean_squared_error(sarimax["obs"], sarimax["pred"])))
    mae = float(mean_absolute_error(sarimax["obs"], sarimax["pred"]))
    nse = nash_sutcliffe(sarimax["obs"], sarimax["pred"])
    peak = peak_rmse(sarimax["obs"], sarimax["pred"])
    sarimax_m = {"rmse": rmse, "mae": mae, "nse": nse, "peak_rmse_p90": peak,
                 "n_holdout": int(len(sarimax["obs"]))}
    print(f"[ench/sarimax] metrics {sarimax_m}")

    lstm_results: dict[int, dict] = {}
    for h in (7, 30, 365):
        lstm_results[h] = run_lstm(y, X_all, horizon=h)
        r = lstm_results[h]
        rmse = float(np.sqrt(mean_squared_error(r["obs"], r["pred"])))
        mae = float(mean_absolute_error(r["obs"], r["pred"]))
        nse = nash_sutcliffe(r["obs"], r["pred"])
        peak = peak_rmse(r["obs"], r["pred"])
        print(f"[ench/lstm:h={h}] rmse={rmse:.3f} mae={mae:.3f} nse={nse:.3f} peak_rmse={peak:.3f}")

    metrics = {
        "sarimax": sarimax_m,
        "lstm": {str(h): {
            "rmse": float(np.sqrt(mean_squared_error(r["obs"], r["pred"]))),
            "mae": float(mean_absolute_error(r["obs"], r["pred"])),
            "nse": nash_sutcliffe(r["obs"], r["pred"]),
            "peak_rmse_p90": peak_rmse(r["obs"], r["pred"]),
            "n_holdout": int(len(r["obs"])),
        } for h, r in lstm_results.items()},
        "holdout_start": HOLDOUT_START.strftime("%Y-%m-%d"),
    }
    (OUT / "ench_metrics.json").write_text(json.dumps(metrics, indent=2))

    print("[ench] producing P10/P50/P90 forecast for next year…")
    future_idx = pd.date_range(y.index.max() + pd.Timedelta(days=1), periods=FORECAST_DAYS, freq="D")
    enso_f = enso.reindex(future_idx).ffill().bfill()
    # extend chirps monthly series with climatology of that month
    cm = chirps.groupby(chirps.index.month).mean()
    chirps_f = pd.Series([cm[d.month] for d in future_idx], index=future_idx)
    all_idx = y.index.append(future_idx)
    enso_all = pd.concat([enso, enso_f])
    chirps_all = pd.concat([chirps, chirps_f])
    X_full = build_exog(all_idx, enso_all, chirps_all)

    res = fit_sarimax(y, X_full[:len(y)])
    X_future = X_full[len(y):]
    fc = res.get_forecast(steps=FORECAST_DAYS, exog=X_future)
    mu = fc.predicted_mean.values
    ci80 = fc.conf_int(alpha=0.2)
    p10 = ci80.iloc[:, 0].values
    p90 = ci80.iloc[:, 1].values
    peak_prob_29 = float(np.mean((mu + 0.5 * (p90 - mu)) > 29.0))
    peak_prob_30 = float(np.mean((mu + 0.5 * (p90 - mu)) > 30.0))

    forecast_df = pd.DataFrame({
        "date": future_idx, "p50": mu, "p10": p10, "p90": p90,
    })
    forecast_df.to_parquet(OUT / "ench_forecast.parquet", index=False)
    web_asset = {
        "generated_at": y.index.max().strftime("%Y-%m-%d"),
        "station": "Porto de Manaus (ANA 14990000)",
        "horizon_days": FORECAST_DAYS,
        "p_exceed_29m": peak_prob_29,
        "p_exceed_30m": peak_prob_30,
        "metrics": metrics,
        "daily": forecast_df.assign(date=forecast_df.date.dt.strftime("%Y-%m-%d")).to_dict(orient="records"),
    }
    (WEB / "ench-flood-forecast.json").write_text(json.dumps(web_asset, indent=2))
    print(f"[ench] saved {WEB/'ench-flood-forecast.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
