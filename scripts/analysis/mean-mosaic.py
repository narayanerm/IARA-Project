#!/usr/bin/env python3
"""
Mean-composite a Sentinel-1 RTC mosaic from cached per-scene crops.

Replaces the "newest wins" compositing of build-sentinel1-mosaic.mjs with a
per-pixel mean over every scene that has data at that pixel. This dissolves the
scene-to-scene seams visible as bright/dark bands in the previous mosaic.

Inputs: /tmp/s1_rtc_cache_<case>/*.png (same crops the node script uses)
Output: public/analysis/data/sentinel1-<case>-mosaic.png (RGBA)
"""
import os
import sys
from pathlib import Path
import numpy as np
from PIL import Image

CASES = {
    'YANO': ('/tmp/s1_rtc_cache_yano', 'sentinel1-yanomami-mosaic.png'),
    'ENCH': ('/tmp/s1_rtc_cache_ench', 'sentinel1-manaus-mosaic.png'),
    'SECA': ('/tmp/s1_rtc_cache_seca', 'sentinel1-manaquiri-mosaic.png'),
}

OUT_DIR = Path('public/analysis/data')


def mean_composite(cache_dir, out_path):
    crops = sorted(Path(cache_dir).glob('*.png'))
    if not crops:
        print(f'  no crops in {cache_dir}')
        return
    # Peek first crop to get size
    first = Image.open(crops[0])
    W, H = first.size
    print(f'  {len(crops)} crops, canvas {W}x{H}')
    sum_l = np.zeros((H, W), dtype=np.float32)
    count = np.zeros((H, W), dtype=np.uint16)
    for i, p in enumerate(crops):
        im = Image.open(p).convert('LA')  # luminance + alpha
        arr = np.asarray(im, dtype=np.uint8)
        l = arr[..., 0].astype(np.float32)
        a = arr[..., 1]
        mask = a > 0
        sum_l += np.where(mask, l, 0)
        count += mask.astype(np.uint16)
        if (i + 1) % 25 == 0 or i == len(crops) - 1:
            print(f'    {i + 1}/{len(crops)}')
    with np.errstate(divide='ignore', invalid='ignore'):
        mean_l = np.where(count > 0, sum_l / np.maximum(count, 1), 0).astype(np.uint8)
    alpha = np.where(count > 0, 255, 0).astype(np.uint8)
    rgba = np.stack([mean_l, mean_l, mean_l, alpha], axis=-1)
    Image.fromarray(rgba, mode='RGBA').save(out_path, optimize=True)
    cov = (count > 0).mean()
    print(f'  wrote {out_path}  coverage={cov:.3f}')


def main():
    os.chdir(Path(__file__).resolve().parents[2])
    target = sys.argv[1].upper() if len(sys.argv) > 1 else None
    cases = [target] if target else list(CASES)
    for case in cases:
        if case not in CASES:
            print(f'unknown case {case}')
            sys.exit(2)
        cache, out = CASES[case]
        print(f'[case {case}] cache={cache}')
        mean_composite(cache, OUT_DIR / out)


if __name__ == '__main__':
    main()
