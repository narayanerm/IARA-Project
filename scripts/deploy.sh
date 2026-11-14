#!/usr/bin/env bash
set -euo pipefail

if [[ $# != 3 ]]; then
    echo "Usage: bash scripts/deploy.sh DIST_DIR SSH_KEY KNOWN_HOSTS" >&2
    exit 2
fi

dist=$1
target=${DEPLOY_TARGET:-ubuntu@ec2-52-38-210-2.us-west-2.compute.amazonaws.com}
test -s "$dist/index.html"
test -d "$dist/assets"

remote_script=$(cat <<'REMOTE'
set -euo pipefail

root=/var/www/curupira
base_url=http://127.0.0.1
exec 9>"$root/.deploy.lock"
flock -w 60 9

stage=$(mktemp -d "$root/.deploy.XXXXXXXX")
published=false
cleanup() {
    result=$?
    if (( result != 0 )) && "$published"; then
        mv -fT "$stage/previous.html" "$root/index.html"
        echo "Deploy check failed. Restored the previous index.html." >&2
    fi
    rm -rf -- "$stage"
    exit "$result"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

tar -xmf - -C "$stage" --no-same-owner --no-same-permissions
test -s "$stage/index.html"
asset=$(sed -nE 's/.*<script[^>]*src="(\/assets\/[a-zA-Z0-9_.-]+\.js)".*/\1/p' "$stage/index.html" | head -n 1)
test -n "$asset"
test -s "$stage$asset"
cp "$root/index.html" "$stage/previous.html"

# Keep earlier hashed assets available to clients with an older HTML page.
# Move each file into place so simultaneous requests never see a partial file.
while IFS= read -r -d '' file; do
    relative=${file#"$stage/"}
    mkdir -p -- "$root/$(dirname -- "$relative")"
    mv -fT -- "$file" "$root/$relative"
done < <(find "$stage" -type f ! -path "$stage/index.html" ! -path "$stage/previous.html" -print0)

cp "$stage/index.html" "$stage/next.html"
published=true
mv -fT "$stage/next.html" "$root/index.html"

curl -fsS --max-time 10 "$base_url/" -o "$stage/served.html"
cmp "$stage/index.html" "$stage/served.html"
curl -fsS --max-time 15 "$base_url$asset" -o "$stage/served.js"
cmp "$root$asset" "$stage/served.js"
echo "Verified the deployed HTML and $asset through Caddy on port 80."
REMOTE
)

tar -cf - -C "$dist" . | ssh -T -i "$2" \
    -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
    -o UserKnownHostsFile="$3" -o ConnectTimeout=10 \
    "$target" "bash -c $(printf '%q' "$remote_script")"
