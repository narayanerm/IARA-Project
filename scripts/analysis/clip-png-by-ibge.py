#!/usr/bin/env python3
"""
Clip a mosaic PNG's alpha channel to an IBGE municipio polygon.
Native MapLibre has no raster-to-polygon clip, so we bake alpha=0 outside the
municipio into the PNG itself. Same trick the YANO mosaic already uses via
clip_to_polygon() with the FUNAI TI polygon.

Usage: python3 scripts/analysis/clip-png-by-ibge.py <ibge_code> <png_path> [more pngs...]

Reads <png>.bounds.json (north/south/west/east) OR <png>.meta.json (bbox [w,s,e,n])
to know the raster's geographic extent. Writes the PNG in-place.
"""
import json
import sys
from pathlib import Path

import requests
from PIL import Image, ImageDraw

IBGE = "https://servicodados.ibge.gov.br/api/v3/malhas/municipios"
CACHE = Path("/tmp/ibge-polygon-cache")
CACHE.mkdir(exist_ok=True)


def load_ibge_polygon(code: str):
    """Return a list of polygon rings (outer ring only per polygon)."""
    cached = CACHE / f"{code}.geojson"
    if not cached.exists() or cached.stat().st_size < 100:
        url = f"{IBGE}/{code}?formato=application/vnd.geo%2Bjson&qualidade=maxima"
        print(f"  [fetch] {url}")
        r = requests.get(url, timeout=60, headers={"Accept-Encoding": "gzip"})
        r.raise_for_status()
        cached.write_text(r.text)  # requests auto-decompresses gzip
    fc = json.loads(cached.read_text())
    feat = fc["features"][0]
    g = feat["geometry"]
    if g["type"] == "Polygon":
        return [g["coordinates"][0]]
    if g["type"] == "MultiPolygon":
        return [poly[0] for poly in g["coordinates"]]
    raise ValueError(f"unexpected geometry type {g['type']}")


def load_bbox(png_path: Path):
    """Try .meta.json first (has 'bbox' [w,s,e,n]) then .bounds.json ({n,s,w,e})."""
    meta = png_path.with_suffix(".meta.json")
    bounds = png_path.with_suffix(".bounds.json")
    if meta.exists():
        m = json.loads(meta.read_text())
        if "bbox" in m:
            w, s, e, n = m["bbox"]
            return float(w), float(s), float(e), float(n)
    if bounds.exists():
        b = json.loads(bounds.read_text())
        return float(b["west"]), float(b["south"]), float(b["east"]), float(b["north"])
    raise FileNotFoundError(f"need {meta.name} or {bounds.name} next to PNG")


def clip_png(png_path: Path, rings, bbox):
    w, s, e, n = bbox
    lng_span = e - w
    lat_span = n - s
    img = Image.open(png_path).convert("RGBA")
    out_w, out_h = img.size

    # Rasterize the polygon into a binary mask at the PNG's resolution.
    mask = Image.new("L", (out_w, out_h), 0)
    draw = ImageDraw.Draw(mask)

    def project(ring):
        return [
            (
                int(round((lon - w) / lng_span * out_w)),
                int(round((n - lat) / lat_span * out_h)),
            )
            for lon, lat in ring
        ]

    for ring in rings:
        draw.polygon(project(ring), fill=255)

    # Where mask==0 (outside municipio): alpha=0 → transparent.
    arr = bytearray(img.tobytes())
    mask_bytes = mask.tobytes()
    # arr is RGBA; replace alpha channel.
    for i, m in enumerate(mask_bytes):
        if m == 0:
            arr[i * 4 + 3] = 0
    img = Image.frombytes("RGBA", (out_w, out_h), bytes(arr))
    img.save(png_path, optimize=True)
    opaque_pct = sum(1 for b in mask_bytes if b) / len(mask_bytes) * 100
    print(f"  [write] {png_path.name}  ({opaque_pct:.1f}% inside polygon)")


def main():
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    code = sys.argv[1]
    print(f"[ibge {code}] loading polygon")
    rings = load_ibge_polygon(code)
    print(f"  → {len(rings)} rings, {sum(len(r) for r in rings)} vertices")
    for arg in sys.argv[2:]:
        p = Path(arg)
        if not p.exists():
            print(f"  skip {p}: missing", file=sys.stderr)
            continue
        bbox = load_bbox(p)
        print(f"[png] {p.name}  bbox={bbox}")
        clip_png(p, rings, bbox)


if __name__ == "__main__":
    main()
