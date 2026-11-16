#!/usr/bin/env sh
# Copies each case's voiced explainer video into public/case-video/ under a fixed name, at full quality.
# Run from the repo root after any new render:   FFMPEG=/path/to/ffmpeg sh scripts/case-videos.sh
#
# For each folder it takes the most recent .mp4 with voice ("voz" in the name, but not "sem_voz"), copies the
# H.264/AAC streams as they are (no re-encode) with the index at the front (+faststart) so playback starts before the
# whole file has downloaded, and saves a poster frame. The app does not depend on the video length.
# The copies (about 12-15 MB each) are committed so the published site serves them.
set -e
FF="${FFMPEG:-ffmpeg}"
ROOT="${VIDEO_ROOT:-..}"
OUT=public/case-video
mkdir -p "$OUT"

copy() {
  dir="$ROOT/$1"
  src=$(ls -t "$dir"/*.mp4 2>/dev/null | grep -i 'voz' | grep -iv 'sem_voz' | head -n 1)
  if [ -z "$src" ]; then
    echo "no voiced .mp4 in $dir" >&2
    return 1
  fi
  "$FF" -y -loglevel error -i "$src" -map 0:v:0 -map '0:a:0?' -c copy -movflags +faststart "$OUT/$2.mp4"
  "$FF" -y -loglevel error -ss 0.5 -i "$OUT/$2.mp4" -frames:v 1 -q:v 3 "$OUT/$2-poster.jpg"
  echo "$2 <- $src"
}

copy video_yanomami yanomami
copy video_enchente enchente-manaus
copy video_seca seca-manaquiri
