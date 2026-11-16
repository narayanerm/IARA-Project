# Estratégia ML — Space Apps 2026

## Bbox por caso (EPSG:4326 lon_min, lat_min, lon_max, lat_max)
- YANO: -66.0, -2.0, -62.5, 2.5
- ENCH: -60.9, -3.3, -59.1, -1.85
- SECA: -61.2, -4.2, -60.2, -3.3

## Datasets confirmados (sem auth salvo onde marcado)

| Dataset | Caso | URL | Formato | Auth |
|---|---|---|---|---|
| ANA 14990000 cotas 1902-2026 | ENCH, SECA | telemetriaws1.ana.gov.br/serviceana.asmx | XML SOAP | nenhuma |
| Zenodo Oliveira 22814118 | ENCH, SECA (fallback) | zenodo.org/records/22814118 | XLSX | nenhuma |
| Sentinel-1 RTC | YANO, SECA | Planetary Computer STAC | COG | nenhuma |
| SRTMGL1 30m | YANO, SECA | s3 opentopography | GeoTIFF | nenhuma |
| CHIRPS daily v2.0 | ENCH, SECA, YANO | data.chc.ucsb.edu | COG | nenhuma |
| GPM IMERG V07 mensal | YANO | Giovanni subset | NetCDF | Earthdata |
| NOAA Niño 3.4 | ENCH | psl.noaa.gov | ASCII | nenhuma |
| DETER-Amz MINERACAO | YANO (target) | terrabrasilis WFS | GeoJSON | nenhuma |
| MapBiomas Alerta | YANO (validação) | production.alerta.mapbiomas.org/geoserver/wfs | GeoJSON | nenhuma |
| Hansen GFC v1.12 lossyear | YANO (feature) | storage.googleapis.com/earthenginepartners-hansen | GeoTIFF | nenhuma |
| JRC GSW Yearly 2024 | SECA | storage.googleapis.com/global-surface-water | GeoTIFF | nenhuma |

## Modelos escolhidos

### YANO — Risco de garimpo 30/60/90d
- Grid 250 m sobre bbox
- Features por pixel: dist_garimpo_existente_t, dist_rio, s1_vv_mean, s1_vh_mean, hansen_loss_until_t, deter_neighbors_2km, chirps_90d, srtm_elev, srtm_slope
- Target binário: pixel virou MINERACAO no DETER entre t e t+90d
- Modelo: XGBoost GPU (tree_method=hist, device=cuda)
- Validação: holdout temporal — treino 2019-2022, val 2023, teste 2024-2025
- Métricas: PR-AUC, recall@top-5%, calibração Brier

### ENCH — Cota Rio Negro 7d/30d/365d
- Série diária ANA 14990000 (1902-2026)
- Baseline: SARIMAX (p,d,q)(P,D,Q)_{365} com termos Fourier m=365.25, k=6 e ENSO exógeno
- Challenger: LSTM univariado+ENSO (torch GPU), window 365d → horizon
- Validação: holdout 2020-2026
- Métricas: RMSE, MAE, NSE (Nash-Sutcliffe), peak-weighted RMSE (acima P90)
- Pico anual: distribuição P(max_year > 29m | ENSO_phase, chuva_bacia_DJF)

### SECA — Isolamento das comunidades
- Derivar área lago via Otsu em Sentinel-1 VH (threshold por cena)
- Curva cota→área via regressão polinomial 3º grau
- Logistic P(isolado_comunidade_c | cota, mes)
- Monte Carlo n=1000 propagando banda P10/P50/P90 do forecast ENCH → dist. dias isolamento por comunidade
- Validação: 2024 (seca histórica) como holdout vs Civil Defense records

## Execução proposta

1. Local: downloads leves (ANA SOAP, NOAA, DETER, MapBiomas) ~50 MB
2. Remote GPU: Sentinel-1 STAC + CHIRPS + Hansen + treino XGBoost + LSTM
3. Sync: rsync das saídas .parquet/.json → public/analysis/data/

## Saídas pro frontend

- public/analysis/data/yano-mining-risk.json — grid + prob 30/60/90d + stats
- public/analysis/data/ench-flood-forecast.json — P10/P50/P90 daily 365d
- public/analysis/data/seca-isolation-forecast.json — por comunidade, dias + prob
- scripts/ml/notebooks/validation.ipynb — métricas + figuras
