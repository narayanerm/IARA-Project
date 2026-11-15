"""Pre-build the NISAR SAR chunks shown by the "SAR" button, so they appear instantly.

For each case region it asks the ASF Search API once, keeps the most recent GCOV scene of every
track/frame that covers the region, downloads its public georeferenced browse image (LATLON PNG),
shrinks it to WebP (alpha kept) and writes public/sar/<region>/manifest.json with the four
corners of every image (MapLibre order: top-left, top-right, bottom-right, bottom-left).

Run from the repo root (needs Python 3 + Pillow):  python scripts/build_sar_tiles.py
"""

import io
import json
import re
import hashlib
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

SEARCH_URL = 'https://api.daac.asf.alaska.edu/services/search/param'
MAX_SIDE = 1600
QUALITY = 78

# Same boxes as src/lib/regions.ts
REGIONS = {
    'YANO': (-64.2, 2.1, -62.6, 3.7),
    'ENCH': (-60.3, -3.3, -59.75, -2.95),
    'SECA': (-60.65, -3.65, -60.1, -3.25),
}

OUT = Path(__file__).resolve().parent.parent / 'public' / 'sar'


CACHE = Path(tempfile.gettempdir()) / 'iara-sar-cache'


def get(url: str, timeout: int = 300, cache: bool = False) -> bytes:
    """GET with retries; big browse PNGs are cached on disk so a rerun does not download them again."""
    hit = CACHE / hashlib.sha1(url.encode()).hexdigest()
    if cache and hit.exists():
        return hit.read_bytes()
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'iara-sar-build/1.0'})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = r.read()
            if cache:
                CACHE.mkdir(exist_ok=True)
                hit.write_bytes(data)
            return data
        except Exception as err:  # network hiccups: retry with backoff
            if attempt == 3:
                raise
            print(f'  retry {attempt + 1} for {url.rsplit("/", 1)[-1]}: {err}', file=sys.stderr)
            time.sleep(3 * (attempt + 1))


def search(bbox):
    q = urllib.parse.urlencode({
        'platform': 'NISAR', 'processingLevel': 'GCOV', 'bbox': ','.join(map(str, bbox)),
        'maxResults': 2000, 'output': 'jsonlite',
    })
    return json.loads(get(f'{SEARCH_URL}?{q}'))['results']


def ring_of(wkt: str):
    m = re.match(r'^POLYGON\s*\(\((.+?)\)', wkt, re.I)
    return [tuple(map(float, p.split())) for p in m.group(1).split(',')]


def point_in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def coverage(ring, bbox, n=20):
    hits = 0
    for i in range(n):
        for j in range(n):
            x = bbox[0] + (i + 0.5) / n * (bbox[2] - bbox[0])
            y = bbox[1] + (j + 0.5) / n * (bbox[3] - bbox[1])
            hits += point_in_ring(x, y, ring)
    return hits / (n * n)


def kml_corners(kml: str):
    quad = re.search(r'LatLonQuad>[\s\S]*?<coordinates>([\s\S]*?)</coordinates>', kml, re.I)
    if quad:
        pts = [tuple(map(float, p.split(',')[:2])) for p in quad.group(1).split()]
        if len(pts) >= 4:  # KML: LL, LR, UR, UL
            return [pts[3], pts[2], pts[1], pts[0]]
    vals = {t: re.search(rf'<{t}>\s*([-0-9.eE+]+)\s*</{t}>', kml, re.I) for t in ('north', 'south', 'east', 'west')}
    if all(vals.values()):
        n, s, e, w = (float(vals[t].group(1)) for t in ('north', 'south', 'east', 'west'))
        return [(w, n), (e, n), (e, s), (w, s)]
    return None


def image_corners(img: Image.Image, ring):
    """LATLON PNG is a lat/lon grid: map its opaque extent onto the footprint's extent."""
    box = img.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    if not box:
        return None
    x0, y0, x1, y1 = box  # x1/y1 exclusive
    W, H = img.size
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    dx = (max(lons) - min(lons)) / (x1 - x0)
    dy = (max(lats) - min(lats)) / (y1 - y0)
    w = min(lons) - x0 * dx
    e = min(lons) + (W - x0) * dx
    n = max(lats) + y0 * dy
    s = max(lats) - (H - y0) * dy
    return [(w, n), (e, n), (e, s), (w, s)]


def main():
    total = 0
    for region, bbox in REGIONS.items():
        results = search(bbox)
        latest = {}
        for r in results:
            png = next((b for b in r.get('browse') or [] if b.endswith('_LATLON.png')), None)
            if not png:
                continue
            ring = ring_of(r['wkt'])
            if coverage(ring, bbox) <= 0:
                continue
            key = (r['path'], r['frame'], (r['flightDirection'] or '?')[0])
            if key not in latest or r['startTime'] > latest[key][0]['startTime']:
                latest[key] = (r, png, ring)

        out_dir = OUT / region
        out_dir.mkdir(parents=True, exist_ok=True)
        for old in out_dir.glob('*.webp'):
            old.unlink()
        chunks = []
        for (track, frame, d), (r, png, ring) in sorted(latest.items()):
            img = Image.open(io.BytesIO(get(png, cache=True))).convert('RGBA')
            corners = None
            try:
                corners = kml_corners(get(png[:-4] + '.kml', 60, cache=True).decode('utf-8', 'replace'))
            except Exception:
                pass
            corners = corners or image_corners(img, ring)
            if not corners:
                print(f'  skip {r["granuleName"]}: no corners', file=sys.stderr)
                continue
            img.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
            name = f'T{track:03d}_F{frame:03d}_{d}.webp'
            img.save(out_dir / name, 'WEBP', quality=QUALITY, method=6)
            size = (out_dir / name).stat().st_size
            total += size
            chunks.append({
                'id': r['granuleName'], 'file': name, 'date': r['startTime'][:10],
                'track': track, 'frame': frame, 'direction': d,
                'corners': [[round(x, 5), round(y, 5)] for x, y in corners],
                'coverage': round(coverage(ring, bbox), 3),
            })
            print(f'{region} {name} {r["startTime"][:10]} {size / 1e3:.0f} kB')
        (out_dir / 'manifest.json').write_text(json.dumps({'region': region, 'bbox': bbox, 'chunks': chunks}, indent=1))
    print(f'total {total / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
