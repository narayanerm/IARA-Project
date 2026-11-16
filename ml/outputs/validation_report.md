# Space Apps 2026 — Validation report

## YANO — Mining expansion risk (XGBoost)

- **train**: n=472500, positives=4339, PR-AUC=0.3165, ROC-AUC=0.9310, Brier=0.0718, recall@top-5%=0.796
- **test**: n=157500, positives=1706, PR-AUC=0.1567, ROC-AUC=0.7970, Brier=0.0803, recall@top-5%=0.518
- Horizonte: None dias; features: 11; device: cuda

## ENCH — Rio Negro level forecast (SARIMAX + LSTM)

**SARIMAX holdout** (1825 days): RMSE=1.820 m, MAE=1.522 m, NSE=0.815, peak-RMSE(P90)=2.050 m

**LSTM h=7 d**: RMSE=0.200, MAE=0.138, NSE=0.998, peak-RMSE=0.117 m
**LSTM h=30 d**: RMSE=0.958, MAE=0.716, NSE=0.949, peak-RMSE=0.304 m
**LSTM h=365 d**: RMSE=2.184, MAE=1.828, NSE=0.707, peak-RMSE=1.816 m

## SECA — Isolation risk (Logistic + Monte Carlo)

- **andiroba**: n_test=8203, pos=1468, ROC-AUC=0.999, Brier=0.0108
- **jutai**: n_test=8203, pos=771, ROC-AUC=0.999, Brier=0.0098
- **barro_alto**: n_test=8203, pos=433, ROC-AUC=0.999, Brier=0.0095
- **janauaca**: n_test=8203, pos=214, ROC-AUC=1.000, Brier=0.0064