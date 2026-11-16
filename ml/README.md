# ML pipeline — Space Apps 2026

Three predictive models for the three cases, all trained on an RTX 5090 pod and
exported as lightweight JSONs consumed by the web app.

## Modelos

| Caso | Alvo | Modelo | Horizonte | Fontes NASA/aliadas |
|---|---|---|---|---|
| **YANO** | Pixel sofrer perda florestal próxima | XGBoost (GPU) sobre features espaciais | 1 ano | Hansen GFC v1.12 (Landsat/NASA), Sentinel-1 RTC (via Planetary Computer), SRTM (NASA) |
| **ENCH** | Cota Rio Negro (m) no Porto de Manaus | SARIMAX com Fourier + ENSO exógeno (CPU) + LSTM challenger (GPU) | 7 / 30 / 365 d | ANA 14990000 (1902–2014), NOAA ERSST Niño 3.4 + SOI |
| **SECA** | Dias com cota < threshold por comunidade | Logistic regression + Monte Carlo n=2000 | 365 d | ANA 14990000 + forecast ENCH |

## Pré-registro (metodologia)

- **Hypothesis frozen antes do treino**: todos os 3 modelos usam holdout temporal estrito (sem leak futuro → passado).
- **Métricas declaradas**: PR-AUC + ROC-AUC + Brier + recall@top5% (YANO); RMSE + MAE + NSE + peak-RMSE (ENCH); ROC-AUC + Brier (SECA).
- **Baseline explícito**: SARIMAX (ENCH) e logistic calibrada (SECA) servem como baselines interpretáveis; LSTM só é challenger.
- Features NASA/aliadas foram escolhidas antes de ver qualquer métrica.

## Limitações reconhecidas

- **ANA SOAP legacy** para de retornar dados pós-2014-12-30. A API nova HidroWebService exige token manual com lifecycle 60 min — incompatível com o janela do hackathon. O modelo ENCH usa 112 anos de observação (1902–2014), o que cobre toda sazonalidade e múltiplos ciclos ENSO, mas o período 2015–2026 não entra como treino observado.
- **RADD alerts** (Wageningen, Sentinel-1) seriam o target ideal para a seção de garimpo mas o bulk download requer auth Earth Engine. Substituído por **Hansen GFC** (Landsat/NASA), que é anual mas captura densamente o desmatamento (incluindo o garimpo, que representa >90% da perda florestal no território Yanomami segundo Hutukara).
- **CHIRPS mensal** era planejado como feature exógena mas o acesso via `/vsigzip//vsicurl/` sobre HTTPS é extremamente lento. O modelo usa ENSO (Niño 3.4 + SOI) como proxy climático suficiente para a bacia do Rio Negro (correlação conhecida com lag 4–12 meses).

## Reproduzir

```bash
ssh pod
cd /root/ml
/usr/bin/python3 downloaders/00_ana_manaus.py
/usr/bin/python3 downloaders/01_noaa_enso.py
/usr/bin/python3 downloaders/03_hansen_yano.py
/usr/bin/python3 downloaders/04_sentinel1_features.py yano seca
/usr/bin/python3 models/train_yano.py
/usr/bin/python3 models/train_ench.py
/usr/bin/python3 models/train_seca.py
/usr/bin/python3 notebooks/validation.py
```

## Entregáveis consumidos pelo frontend

- `public/analysis/data/yano-mining-risk.json` — grid hotspots + métricas
- `public/analysis/data/ench-flood-forecast.json` — P10/P50/P90 diário 365 d + prob excedência 29 m / 30 m
- `public/analysis/data/seca-isolation-forecast.json` — por comunidade, dias esperados de isolamento + prob diária
