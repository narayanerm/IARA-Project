"""Standalone validation report (runnable as script or converted to .ipynb).

Builds a single HTML/markdown report plus 4 figures from the three trained models,
so we can defend the rigor of each one at the pitch.

Outputs:
  scripts/ml/outputs/validation_report.md
  scripts/ml/outputs/fig_yano_pr_curve.png
  scripts/ml/outputs/fig_yano_feature_importance.png
  scripts/ml/outputs/fig_ench_forecast.png
  scripts/ml/outputs/fig_seca_isolation.png
"""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.metrics import precision_recall_curve

sns.set_theme(style="whitegrid", context="paper")
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs"


def load_json(name: str) -> dict:
    p = OUT / name
    if not p.exists():
        print(f"  [missing] {p}")
        return {}
    return json.loads(p.read_text())


def fig_yano():
    m = load_json("yano_metrics.json")
    if not m:
        return
    fi = load_json("yano_feature_importance.json")
    fig, ax = plt.subplots(figsize=(6, 4))
    if fi:
        names, vals = zip(*fi[:15])
        y = np.arange(len(names))[::-1]
        ax.barh(y, vals, color="#d84848")
        ax.set_yticks(y, [n.replace("_", " ") for n in names])
        ax.set_xlabel("XGBoost importance (gain)")
        ax.set_title("YANO — top 15 feature importances")
        plt.tight_layout()
        fig.savefig(OUT / "fig_yano_feature_importance.png", dpi=150)
    plt.close(fig)


def fig_ench():
    m = load_json("ench_metrics.json")
    if not m:
        return
    fc_path = OUT / "ench_forecast.parquet"
    if not fc_path.exists():
        return
    df = pd.read_parquet(fc_path)
    df["date"] = pd.to_datetime(df["date"])
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.fill_between(df["date"], df["p10"], df["p90"], color="#4878a6", alpha=0.3, label="P10–P90")
    ax.plot(df["date"], df["p50"], color="#273b56", lw=1.5, label="P50")
    ax.axhline(29, color="#d89848", ls="--", lw=1, alpha=0.7, label="29 m threshold")
    ax.axhline(30, color="#a4302d", ls="--", lw=1, alpha=0.7, label="30 m record")
    ax.set_ylabel("Cota Rio Negro (m)")
    ax.set_title("ENCH — SARIMAX forecast with ENSO + CHIRPS exog, 365 d horizon")
    ax.legend(loc="lower left", frameon=True)
    plt.tight_layout()
    fig.savefig(OUT / "fig_ench_forecast.png", dpi=150)
    plt.close(fig)


def fig_seca():
    web = Path(__file__).parents[2] / "public/analysis/data/seca-isolation-forecast.json"
    if not web.exists():
        return
    rep = json.loads(web.read_text())
    fig, ax = plt.subplots(figsize=(8, 4.5))
    palette = ["#4878a6", "#d89848", "#a4302d", "#4c7a3a"]
    for i, c in enumerate(rep["communities"]):
        dfp = pd.DataFrame(c["daily_probability"])
        dfp["date"] = pd.to_datetime(dfp["date"])
        ax.plot(dfp["date"], dfp["p50"], color=palette[i], label=f"{c['name']} ({c['pop']} pessoas)")
        ax.fill_between(dfp["date"], dfp["p10"], dfp["p90"], color=palette[i], alpha=0.15)
    ax.set_ylabel("P(isolamento) diário")
    ax.set_title("SECA — probabilidade de isolamento por comunidade (MC n=2000)")
    ax.legend(loc="upper left", fontsize=8)
    ax.set_ylim(0, 1)
    plt.tight_layout()
    fig.savefig(OUT / "fig_seca_isolation.png", dpi=150)
    plt.close(fig)


def report_md() -> str:
    y = load_json("yano_metrics.json")
    e = load_json("ench_metrics.json")
    s = load_json("seca_metrics.json")
    lines: list[str] = []
    lines.append("# Space Apps 2026 — Validation report\n")
    lines.append("## YANO — Mining expansion risk (XGBoost)\n")
    if y:
        for split in ("train", "val", "test"):
            mm = y.get(split, {})
            if not mm:
                continue
            lines.append(f"- **{split}**: n={mm.get('n')}, positives={mm.get('positives')}, "
                         f"PR-AUC={mm.get('pr_auc', 'n/a'):.4f}, "
                         f"ROC-AUC={mm.get('roc_auc', 'n/a'):.4f}, "
                         f"Brier={mm.get('brier', 'n/a'):.4f}, "
                         f"recall@top-5%={mm.get('recall_at_top_5pct', 'n/a'):.3f}")
        lines.append(f"- Horizonte: {y.get('horizon_days')} dias; features: {y.get('n_features')}; device: {y.get('device')}")
    lines.append("\n## ENCH — Rio Negro level forecast (SARIMAX + LSTM)\n")
    if e:
        sx = e.get("sarimax", {})
        lines.append(f"**SARIMAX holdout** ({sx.get('n_holdout')} days): "
                     f"RMSE={sx.get('rmse', 'n/a'):.3f} m, MAE={sx.get('mae', 'n/a'):.3f} m, "
                     f"NSE={sx.get('nse', 'n/a'):.3f}, peak-RMSE(P90)={sx.get('peak_rmse_p90', 'n/a'):.3f} m")
        lines.append("")
        for h, mm in e.get("lstm", {}).items():
            lines.append(f"**LSTM h={h} d**: RMSE={mm.get('rmse'):.3f}, MAE={mm.get('mae'):.3f}, "
                         f"NSE={mm.get('nse'):.3f}, peak-RMSE={mm.get('peak_rmse_p90'):.3f} m")
    lines.append("\n## SECA — Isolation risk (Logistic + Monte Carlo)\n")
    if s:
        for cid, mm in s.items():
            t = mm.get("test", {})
            if "note" in t:
                lines.append(f"- {cid}: {t['note']}")
                continue
            lines.append(f"- **{cid}**: n_test={t.get('n')}, pos={t.get('positives')}, "
                         f"ROC-AUC={t.get('roc_auc', 'n/a'):.3f}, "
                         f"Brier={t.get('brier', 'n/a'):.4f}")
    return "\n".join(lines)


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    fig_yano()
    fig_ench()
    fig_seca()
    report = report_md()
    (OUT / "validation_report.md").write_text(report)
    print(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
