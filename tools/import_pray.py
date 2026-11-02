#!/usr/bin/env python3
"""Bring Gemini's prayer poses into the game.

Put the images in gemini/incoming/ named by outfit and pose, then run:  python3 tools/import_pray.py

  man_1.png … man_4.png      one pose per image, or
  man.png                    all four poses side by side in one image (split automatically, left → right)

Outfits: man, woman, granny, nun, monk, child.
Poses:   1 kneeling, palms joined at the chest · 2 joined palms raised to the forehead
         3 bending forward halfway · 4 full prostration, forehead on the floor

The plain background is removed (flood fill from the edges), each pose is trimmed to its figure and saved as
public/assets/pray/<outfit>_<n>.png. The game picks them up on reload; an outfit with any pose missing keeps
the built-in bow.
"""
from pathlib import Path
import json
import re
import sys

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'gemini' / 'incoming'
OUT = ROOT / 'public' / 'assets' / 'pray'
OUTFITS = ['man', 'woman', 'granny', 'nun', 'monk', 'child']
TOLERANCE = 38  # how far (per channel) a pixel may be from the background colour and still count as background
HOLE_TOLERANCE = 22  # stricter for gaps inside the figure, so light parts of the clothes are not mistaken for them
MIN_HOLE = 400  # pixels; an enclosed patch smaller than this is kept
MAX_HEIGHT = 420  # in-game sprites are ~300 px tall; keep a little headroom for quality


def remove_background(im):
    """Transparent background: flood from every edge pixel that matches the corner colours."""
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    if any(px[x, y][3] < 250 for x, y in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]):
        return im  # already transparent
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]

    def is_bg(p):
        return any(all(abs(p[i] - c[i]) <= TOLERANCE for i in range(3)) for c in corners)

    seen = bytearray(w * h)
    stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while stack:
        x, y = stack.pop()
        i = y * w + x
        if seen[i] or not is_bg(px[x, y]):
            continue
        seen[i] = 1
        px[x, y] = (0, 0, 0, 0)
        if x > 0: stack.append((x - 1, y))
        if x < w - 1: stack.append((x + 1, y))
        if y > 0: stack.append((x, y - 1))
        if y < h - 1: stack.append((x, y + 1))
    # Background showing through closed gaps (between an arm and the head, between the knees) is not reachable
    # from the edges. Clear every sizeable patch that is close to the background colour; small specks are left,
    # since they are more likely highlights in the painting.
    def is_hole(p):
        return any(all(abs(p[i] - c[i]) <= HOLE_TOLERANCE for i in range(3)) for c in corners)

    for y0 in range(h):
        for x0 in range(w):
            if px[x0, y0][3] == 0 or not is_hole(px[x0, y0]):
                continue
            region, stack = [], [(x0, y0, px[x0, y0])]
            px[x0, y0] = (0, 0, 0, 1)  # mark as visited
            while stack:
                x, y, p = stack.pop()
                region.append((x, y, p))
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] > 1 and is_hole(px[nx, ny]):
                        stack.append((nx, ny, px[nx, ny]))
                        px[nx, ny] = (0, 0, 0, 1)
            keep = len(region) < MIN_HOLE
            for x, y, p in region:
                px[x, y] = p if keep else (0, 0, 0, 0)
    # Soften the cut edge by a pixel so it does not look jagged over the painting.
    alpha = im.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    im.putalpha(alpha)
    return im


def split_sheet(im, count=4):
    """Cut a side-by-side sheet into figures using the empty columns between them."""
    alpha = im.getchannel('A')
    w, h = im.size
    filled = [any(alpha.getpixel((x, y)) > 40 for y in range(0, h, 2)) for x in range(w)]
    runs, start = [], None
    for x, f in enumerate(filled + [False]):
        if f and start is None:
            start = x
        elif not f and start is not None:
            runs.append((start, x))
            start = None
    runs = sorted(sorted(runs, key=lambda r: r[1] - r[0], reverse=True)[:count])
    if len(runs) != count:
        raise ValueError(f'found {len(runs)} figures, expected {count}')
    return [im.crop((a, 0, b, h)) for a, b in runs]


def finish(im):
    im = im.crop(im.getchannel('A').point(lambda a: 255 if a > 40 else 0).getbbox())
    if im.height > MAX_HEIGHT:
        im = im.resize((round(im.width * MAX_HEIGHT / im.height), MAX_HEIGHT), Image.LANCZOS)
    return im


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = sorted(p for p in SRC.iterdir() if p.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp'))
    if not files:
        sys.exit(f'Không có ảnh nào trong {SRC}')
    done = {}
    for f in files:
        m = re.fullmatch(r'(\w+?)(?:_([1-4]))?', f.stem.lower())
        if not m or m.group(1) not in OUTFITS:
            print(f'  bỏ qua {f.name}: tên phải là <y phục>_<1-4> hoặc <y phục>, y phục: {", ".join(OUTFITS)}')
            continue
        outfit, n = m.group(1), m.group(2)
        im = remove_background(Image.open(f))
        try:
            poses = [im] if n else split_sheet(im)
        except ValueError as e:
            print(f'  {f.name}: không tách được 4 dáng ({e}). Hãy để các dáng cách nhau rõ, hoặc lưu từng dáng riêng.')
            continue
        for i, pose in enumerate(poses, start=int(n or 1)):
            finish(pose).save(OUT / f'{outfit}_{i}.png')
            done.setdefault(outfit, set()).add(i)
        print(f'  {f.name} → {", ".join(f"{outfit}_{i}.png" for i in range(int(n or 1), int(n or 1) + len(poses)))}')
    complete = []
    for outfit in OUTFITS:
        have = {int(p.stem.split('_')[1]) for p in OUT.glob(f'{outfit}_[1-4].png')}
        if not {1, 2, 3, 4} - have:
            complete.append(outfit)
        missing = sorted({1, 2, 3, 4} - have)
        state = 'đủ 4 dáng, game sẽ dùng' if not missing else f'còn thiếu dáng {", ".join(map(str, missing))}'
        if have:
            print(f'{outfit}: {state}')
    # The game only loads outfits listed here, so a half-finished set never shows up.
    (OUT / 'manifest.json').write_text(json.dumps({'outfits': complete}) + '\n')


if __name__ == '__main__':
    main()
