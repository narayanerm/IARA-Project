#!/usr/bin/env bash
# Pull trained model outputs from the GPU pod into the web project.
set -euo pipefail

POD_HOST="root@82.67.147.193"
POD_PORT=35099
POD_ALIAS="lium-pod-44cbb8e9-8d05-4ba1-8d08-2f3dac62a469"
IDENT="$HOME/.ssh/id_ed25519"
LOCAL_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

SSH_OPTS=(-o HostKeyAlias="$POD_ALIAS" -i "$IDENT" -p "$POD_PORT")

echo "[sync] pulling JSON web assets → public/analysis/data/"
rsync -av -e "ssh ${SSH_OPTS[*]}" \
  "$POD_HOST":/root/ml/outputs/web/ \
  "$LOCAL_ROOT/public/analysis/data/"

echo "[sync] pulling metrics + figures → scripts/ml/outputs/"
rsync -av -e "ssh ${SSH_OPTS[*]}" \
  --exclude 'web/' \
  "$POD_HOST":/root/ml/outputs/ \
  "$LOCAL_ROOT/scripts/ml/outputs/"

echo "[sync] pulling training logs → scripts/ml/logs/"
rsync -av -e "ssh ${SSH_OPTS[*]}" \
  "$POD_HOST":/root/ml/logs/ \
  "$LOCAL_ROOT/scripts/ml/logs/"

echo "[sync] done."
ls -la "$LOCAL_ROOT/public/analysis/data/"*forecast*.json "$LOCAL_ROOT/public/analysis/data/"*risk*.json 2>/dev/null || true
