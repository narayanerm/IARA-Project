"""YANO — deforestation (mining-case) risk model.

Target: Hansen Global Forest Change v1.12 lossyear raster. For each annual
timestamp t in {2020…2024}, the binary label is "pixel had forest loss in
year t+1" (so model predicts one year ahead). Hansen uses Landsat (NASA) so
it is NASA-aligned, dense (10-year history) and covers mining-driven loss in
Yanomami where >90% of loss is garimpo (per Hutukara Yanomami Association).

Note: RADD alerts (Wageningen, Sentinel-1 derived) would give sub-annual
granularity but their bulk download requires Earth Engine auth that does not
fit the hackathon window. Hansen is the pragmatic NASA-aligned substitute.

Static features: SRTM elev+slope (if available), Sentinel-1 RTC VV/VH p10/p50/p90.
Time features: distance to any previous Hansen loss pixel at year t, cumulative
Hansen loss within 2 km buffer, month-of-year cycle, CHIRPS basin precip
climatology anomaly.

Validation: temporal holdout — train on labels 2020→2021, 2021→2022, 2022→2023;
test on label 2023→2024.

Metrics: PR-AUC, ROC-AUC, Brier calibration, recall@top-5%, precision@top-5%.

Outputs:
  scripts/ml/outputs/yano_metrics.json
  scripts/ml/outputs/yano_feature_importance.json
  scripts/ml/outputs/yano_risk_grid.parquet
  public/analysis/data/yano-mining-risk.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import rioxarray
import torch
import xarray as xr
import xgboost as xgb
from scipy.ndimage import distance_transform_edt, uniform_filter
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    roc_auc_score,
)

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/raw"
OUT = ROOT / "outputs"
WEB = ROOT / "outputs/web"  # synced back to public/analysis/data by the orchestrator

BBOX = (-66.0, -2.0, -62.5, 2.5)
PIXEL_DEG = 0.01            # ~1.1 km → ~157k pixels
TRAIN_YEARS = [2020, 2021, 2022]
TEST_YEARS = [2023]
PREDICT_YEAR = 2025
HANSEN_RES_FACTOR = 44      # 1.1km/25m ≈ 44


def build_grid() -> pd.DataFrame:
    xs = np.arange(BBOX[0] + PIXEL_DEG / 2, BBOX[2], PIXEL_DEG)
    ys = np.arange(BBOX[1] + PIXEL_DEG / 2, BBOX[3], PIXEL_DEG)
    gx, gy = np.meshgrid(xs, ys)
    return pd.DataFrame({"lon": gx.ravel(), "lat": gy.ravel()})


def _nearest_sample(da: xr.DataArray, grid: pd.DataFrame) -> np.ndarray:
    return da.sel(x=xr.DataArray(grid["lon"].values, dims="z"),
                  y=xr.DataArray(grid["lat"].values, dims="z"),
                  method="nearest").values


def load_hansen() -> xr.DataArray:
    da = rioxarray.open_rasterio(RAW / "hansen_lossyear_yano.tif", masked=False).squeeze("band", drop=True)
    return da.astype(np.int16)


def hansen_label_year(h: xr.DataArray, grid: pd.DataFrame, year: int) -> np.ndarray:
    """Binary label: any Hansen loss at year-2000 encoding == year."""
    tag = year - 2000
    mask = (h.values == tag).astype(np.uint8)
    agg = uniform_filter(mask.astype(np.float32), size=HANSEN_RES_FACTOR) > 0
    da = xr.DataArray(agg.astype(np.uint8), dims=h.dims, coords=h.coords)
    return _nearest_sample(da, grid).astype(np.int8)


def hansen_cumulative_until(h: xr.DataArray, grid: pd.DataFrame, year: int) -> np.ndarray:
    tag_max = year - 2000
    mask = ((h.values > 0) & (h.values <= tag_max)).astype(np.uint8)
    agg = uniform_filter(mask.astype(np.float32), size=HANSEN_RES_FACTOR)
    da = xr.DataArray(agg, dims=h.dims, coords=h.coords)
    return _nearest_sample(da, grid)


def dist_prior_loss(h: xr.DataArray, grid: pd.DataFrame, year: int) -> np.ndarray:
    tag_max = year - 2000
    mask = (h.values > 0) & (h.values <= tag_max)
    if not mask.any():
        return np.full(len(grid), 1e3)
    inv = (~mask).astype(np.uint8)
    pix = distance_transform_edt(inv)
    km_per_deg = 111.0
    dx = float(abs(h.x[1] - h.x[0])) if h.x.size > 1 else 2.5e-4
    km_per_pix = dx * km_per_deg
    dist_km = pix * km_per_pix
    da = xr.DataArray(dist_km, dims=h.dims, coords=h.coords)
    return _nearest_sample(da, grid)


def load_srtm(grid: pd.DataFrame) -> dict[str, np.ndarray]:
    p = RAW / "srtm_yano.tif"
    if not p.exists():
        return {"srtm_elev": np.zeros(len(grid)), "srtm_slope": np.zeros(len(grid))}
    da = rioxarray.open_rasterio(p, masked=True).squeeze("band", drop=True)
    elev = _nearest_sample(da, grid)
    gy, gx = np.gradient(da.values.astype(np.float32))
    slope = np.hypot(gx, gy)
    slope_da = xr.DataArray(slope, dims=da.dims, coords=da.coords)
    return {"srtm_elev": np.nan_to_num(elev, nan=np.nanmedian(elev)),
            "srtm_slope": np.nan_to_num(_nearest_sample(slope_da, grid), nan=0)}


def load_s1(grid: pd.DataFrame) -> dict[str, np.ndarray]:
    p = RAW / "s1_stats_yano.tif"
    if not p.exists():
        print(f"[yano] WARN no S1 features at {p}; using zeros", flush=True)
        return {f"s1_{b}": np.zeros(len(grid))
                for b in ("vv_p50", "vv_p10", "vv_p90", "vh_p50", "vh_std")}
    ds = rioxarray.open_rasterio(p, masked=True)
    names_attr = ds.attrs.get("long_name")
    if isinstance(names_attr, str):
        names = [n.strip() for n in names_attr.split(",")]
    elif isinstance(names_attr, (list, tuple)):
        names = list(names_attr)
    else:
        names = [f"b{i}" for i in range(ds.sizes["band"])]
    out: dict[str, np.ndarray] = {}
    for i, b in enumerate(names):
        vals = _nearest_sample(ds.isel(band=i), grid)
        out[f"s1_{b}"] = np.nan_to_num(vals, nan=np.nanmedian(vals))
    return out


def load_chirps_basin() -> pd.Series | None:
    p = RAW / "chirps_monthly_bacia_negro.nc"
    if not p.exists():
        return None
    da = xr.open_dataset(p)["precip_mm"]
    return da.mean(["x", "y"]).to_pandas()


def chirps_year_sum(series: pd.Series | None, year: int) -> float:
    if series is None:
        return 0.0
    yr = series[series.index.year == year]
    return float(yr.sum()) if len(yr) else 0.0


def assemble_frame(grid: pd.DataFrame, year: int,
                   static: dict[str, np.ndarray],
                   hansen: xr.DataArray,
                   chirps: pd.Series | None,
                   predict_only: bool = False) -> pd.DataFrame:
    rows = grid.copy()
    for k, v in static.items():
        rows[k] = v
    print(f"  [yano] year={year}…", flush=True)
    rows["hansen_cum_buffer"] = hansen_cumulative_until(hansen, grid, year)
    rows["dist_prior_loss_km"] = dist_prior_loss(hansen, grid, year)
    rows["chirps_year"] = chirps_year_sum(chirps, year)
    rows["year_norm"] = (year - 2020) / 5.0
    rows["y"] = 0 if predict_only else hansen_label_year(hansen, grid, year + 1)
    rows["year"] = year
    return rows


def metric_block(name: str, y_true: np.ndarray, p: np.ndarray) -> dict:
    out = {"split": name, "n": int(len(y_true)), "positives": int(y_true.sum())}
    if y_true.sum() == 0:
        out["note"] = "no positives"
        return out
    out["pr_auc"] = float(average_precision_score(y_true, p))
    out["roc_auc"] = float(roc_auc_score(y_true, p))
    out["brier"] = float(brier_score_loss(y_true, p))
    topk = int(np.ceil(0.05 * len(y_true)))
    ord_ = np.argsort(-p)
    out["recall_at_top_5pct"] = float(y_true[ord_[:topk]].sum() / y_true.sum())
    out["precision_at_top_5pct"] = float(y_true[ord_[:topk]].sum() / topk)
    return out


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    WEB.mkdir(parents=True, exist_ok=True)
    print("[yano] building grid…", flush=True)
    grid = build_grid()
    print(f"[yano] grid: {len(grid):,} pixels", flush=True)

    print("[yano] loading Hansen GFC…", flush=True)
    hansen = load_hansen()
    print(f"[yano] Hansen shape={hansen.shape}, total loss pixels={int((hansen.values>0).sum()):,}", flush=True)

    print("[yano] loading static rasters…", flush=True)
    static = {**load_srtm(grid), **load_s1(grid)}
    chirps = load_chirps_basin()

    frames: list[pd.DataFrame] = []
    for yr in TRAIN_YEARS + TEST_YEARS:
        frames.append(assemble_frame(grid, yr, static, hansen, chirps))
    panel = pd.concat(frames, ignore_index=True)
    feats = [c for c in panel.columns if c not in ("lon", "lat", "y", "year")]
    print(f"[yano] features ({len(feats)}): {feats}", flush=True)
    for yr, chunk in panel.groupby("year"):
        pos = int(chunk["y"].sum())
        print(f"  year={yr}: n={len(chunk):,} pos={pos} ({pos/len(chunk)*100:.3f}%)", flush=True)

    train = panel[panel["year"].isin(TRAIN_YEARS)]
    test = panel[panel["year"].isin(TEST_YEARS)]

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[yano] training XGBoost on {device}", flush=True)
    pos = (train["y"] == 1).sum()
    neg = (train["y"] == 0).sum()
    spw = max(1.0, neg / max(1, pos))
    model = xgb.XGBClassifier(
        n_estimators=800, max_depth=6, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8, reg_lambda=1.0,
        tree_method="hist", device=device, eval_metric="aucpr",
        scale_pos_weight=spw, early_stopping_rounds=50,
    )
    if test["y"].sum() > 0:
        model.fit(train[feats], train["y"],
                  eval_set=[(test[feats], test["y"])], verbose=False)
    else:
        model.fit(train[feats], train["y"], verbose=False)

    p_train = model.predict_proba(train[feats])[:, 1]
    p_test = model.predict_proba(test[feats])[:, 1] if len(test) else np.array([])
    results = {
        "train": metric_block("train", train["y"].values, p_train),
        "test": metric_block("test", test["y"].values, p_test) if len(test) else {"note": "no test"},
        "horizon": "1 year ahead",
        "n_features": len(feats),
        "feature_names": feats,
        "device": device,
        "pos_weight": float(spw),
        "target": "Hansen GFC v1.12 forest loss within next calendar year",
        "notes": "RADD alerts bulk download requires auth; Hansen used as NASA-aligned (Landsat) target.",
    }
    (OUT / "yano_metrics.json").write_text(json.dumps(results, indent=2))
    print(f"[yano] train {results['train']}", flush=True)
    print(f"[yano] test  {results['test']}", flush=True)

    imp = sorted(zip(feats, map(float, model.feature_importances_)), key=lambda kv: -kv[1])
    (OUT / "yano_feature_importance.json").write_text(json.dumps(imp, indent=2))

    print(f"[yano] predicting risk for year {PREDICT_YEAR}…", flush=True)
    pred = assemble_frame(grid, PREDICT_YEAR, static, hansen, chirps, predict_only=True)
    pred["risk"] = model.predict_proba(pred[feats])[:, 1]
    pred[["lon", "lat", "risk", "dist_prior_loss_km", "hansen_cum_buffer"]].to_parquet(
        OUT / "yano_risk_grid.parquet", index=False)

    q90 = float(np.quantile(pred["risk"], 0.9))
    q95 = float(np.quantile(pred["risk"], 0.95))
    q99 = float(np.quantile(pred["risk"], 0.99))
    hotspots = pred.nlargest(500, "risk")[["lon", "lat", "risk"]]
    web_asset = {
        "horizon": "1 year ahead",
        "forecast_year": PREDICT_YEAR,
        "generated_at": "2026-11-15",
        "target": results["target"],
        "bbox": list(BBOX),
        "pixel_deg": PIXEL_DEG,
        "n_pixels": int(len(pred)),
        "metrics": {"train": results["train"], "test": results["test"]},
        "thresholds": {"p90": q90, "p95": q95, "p99": q99},
        "hotspots": hotspots.to_dict(orient="records"),
    }
    (WEB / "yano-mining-risk.json").write_text(json.dumps(web_asset, indent=2))
    print(f"[yano] saved {WEB/'yano-mining-risk.json'}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
