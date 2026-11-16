#!/bin/bash
set -x
cd /root/ml
mkdir -p logs
/usr/bin/python3 downloaders/03_hansen_yano.py > logs/03_hansen.log 2>&1 &
PID_HANSEN=$!
/usr/bin/python3 downloaders/05_chirps_monthly.py > logs/05_chirps.log 2>&1 &
PID_CHIRPS=$!
/usr/bin/python3 downloaders/04_sentinel1_features.py yano > logs/04_s1_yano.log 2>&1 &
PID_S1Y=$!
/usr/bin/python3 downloaders/04_sentinel1_features.py seca > logs/04_s1_seca.log 2>&1 &
PID_S1S=$!
wait $PID_HANSEN $PID_CHIRPS $PID_S1Y $PID_S1S
echo "ALL_DONE" > logs/_status
