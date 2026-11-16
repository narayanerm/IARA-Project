#!/bin/bash
cd /root/ml
exec 1>>logs/_phase2.log 2>&1
set -x
date
/usr/bin/python3 -u downloaders/04_sentinel1_features.py yano &
Y=$!
/usr/bin/python3 -u downloaders/04_sentinel1_features.py seca &
S=$!
/usr/bin/python3 -u downloaders/05_chirps_monthly.py bacia_negro &
C=$!
wait $Y $S $C
date
echo PHASE2_DONE > logs/_phase2_done
