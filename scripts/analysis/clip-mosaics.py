#!/usr/bin/env python3
"""
Apply alpha mask shaped like the case perimeter to the SAR mosaic PNGs.
Pixels outside the perimeter get alpha=0 so MapLibre can render the mosaic
on top of the Sentinel-2 basemap without hiding what is outside the polygon.

Inputs: perimeter geojsons (local for YANO, IBGE for ENCH/SECA) + bbox meta.
Outputs: overwrites each PNG in-place with the clipped version.
"""
import gzip
import json
import os
import sys
import urllib.request
from pathlib import Path
from PIL import Image, ImageDraw

DATA = Path('public/analysis/data')

# (png, perimeter source, bbox [W, S, E, N])
# bbox must match the extent used when the PNG was built (see .meta.json / inline bbox in YanomamiCaseLayers.tsx)
TARGETS = [
    # Sentinel-1 C
    ('sentinel1-yanomami-mosaic.png', 'yano-polygon', [-66.5, -0.5, -61.0, 4.5]),
    ('sentinel1-manaus-mosaic.png', 'ibge:1302603', [-60.9, -3.3, -59.1, -1.85]),
    ('sentinel1-manaquiri-mosaic.png', 'ibge:1302553', [-61.2, -4.2, -60.2, -3.3]),
    # NISAR L / S for ENCH and SECA (YANO NISAR already clipped during build)
    ('manaus-nisar-mosaic.png', 'ibge:1302603', [-60.9, -3.3, -59.1, -1.85]),
    ('manaus-nisar-sband-mosaic.png', 'ibge:1302603', [-60.9, -3.3, -59.1, -1.85]),
    ('manaquiri-nisar-mosaic.png', 'ibge:1302553', [-61.2, -4.2, -60.2, -3.3]),
    ('manaquiri-nisar-sband-mosaic.png', 'ibge:1302553', [-61.2, -4.2, -60.2, -3.3]),
]


def load_perimeter(source):
    if source == 'yano-polygon':
        with open(DATA / 'yanomami-polygon.geojson') as f:
            return json.load(f)
    if source.startswith('ibge:'):
        code = source.split(':', 1)[1]
        url = f'https://servicodados.ibge.gov.br/api/v3/malhas/municipios/{code}?formato=application/vnd.geo+json&qualidade=intermediaria'
        req = urllib.request.Request(url, headers={'Accept-Encoding': 'identity'})
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            if raw[:2] == b'\x1f\x8b':
                raw = gzip.decompress(raw)
            return json.loads(raw.decode('utf-8'))
    raise ValueError(f'unknown perimeter source: {source}')


def iter_rings(geom):
    t = geom['type']
    if t == 'Polygon':
        yield from geom['coordinates']
    elif t == 'MultiPolygon':
        for poly in geom['coordinates']:
            yield from poly
    else:
        raise ValueError(f'unsupported geometry: {t}')


def rasterize(features, bbox, size):
    w, s, e, n = bbox
    W, H = size
    mask = Image.new('L', (W, H), 0)
    draw = ImageDraw.Draw(mask)
    for feat in features:
        rings = list(iter_rings(feat['geometry']))
        for i, ring in enumerate(rings):
            px = [((x - w) / (e - w) * W, (n - y) / (n - s) * H) for x, y in ring]
            # First ring is outer (fill 255), subsequent rings are holes (fill 0).
            draw.polygon(px, fill=0 if i > 0 else 255)
    return mask


def clip_one(png_name, source, bbox):
    png_path = DATA / png_name
    if not png_path.exists():
        print(f'  SKIP {png_name} (not found)')
        return
    im = Image.open(png_path).convert('RGBA')
    fc = load_perimeter(source)
    feats = fc['features'] if fc.get('type') == 'FeatureCollection' else [fc]
    mask = rasterize(feats, bbox, im.size)
    # Combine: new_alpha = old_alpha AND perimeter_mask
    r, g, b, a = im.split()
    a_new = Image.eval(a, lambda v: v)
    a_new = Image.composite(a_new, Image.new('L', im.size, 0), mask)
    im_clipped = Image.merge('RGBA', (r, g, b, a_new))
    im_clipped.save(png_path, optimize=True)
    cov = sum(1 for p in a_new.getdata() if p > 0) / (im.size[0] * im.size[1])
    print(f'  {png_name}: coverage after clip = {cov:.3f}')


def main():
    os.chdir(Path(__file__).resolve().parents[2])
    for png, source, bbox in TARGETS:
        print(f'[clip] {png}  ({source})')
        clip_one(png, source, bbox)


if __name__ == '__main__':
    main()
