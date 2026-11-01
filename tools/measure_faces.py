# 포즈 24장의 얼굴 중심(faceAnchor) 1차 추정 + 확인 이미지 생성
# 사용: python tools/measure_faces.py   → handoff_v2/pose_verify/ 에 시트 4장, tools/face_auto.json 에 자동 추정값
import json, sys, os
import numpy as np
from PIL import Image, ImageDraw
from collections import deque
ROOT = os.path.join(os.path.dirname(__file__), '..')
meta = json.load(open(os.path.join(ROOT, 'handoff_v2/pose_meta_draft.json'), encoding='utf-8'))
S = 4  # 다운샘플
def skin(a):
    r, g, b, al = [a[..., i].astype(int) for i in range(4)]
    return (al > 200) & (r > 205) & (g > 140) & (g < 215) & (b > 95) & (b < 190) & (r - g > 12) & (g - b > 12) & (r - g < 90)
out = {}
for c, v in meta['characters'].items():
    for p in v['poses']:
        im = Image.open(os.path.join(ROOT, 'dist', p['file'])).convert('RGBA')
        a = np.array(im)
        m = skin(a)[::S, ::S]
        h, w = m.shape; seen = np.zeros_like(m, bool); comps = []
        for y in range(h):
            for x in range(w):
                if m[y, x] and not seen[y, x]:
                    q = deque([(y, x)]); seen[y, x] = True; pts = []
                    while q:
                        cy, cx = q.popleft(); pts.append((cy, cx))
                        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not seen[ny, nx]:
                                seen[ny, nx] = True; q.append((ny, nx))
                    comps.append(pts)
        bb = p['bbox']; top = bb['y0'] / S; hgt = (bb['y1'] - bb['y0']) / S
        best = None
        for pts in comps:
            ys = np.array([q[0] for q in pts]); xs = np.array([q[1] for q in pts])
            cy = ys.mean(); 
            if cy > top + hgt * 0.62 or len(pts) < 25: continue
            score = len(pts) - 0.5 * max(0, (cy - top)) * 1.0
            if not best or score > best[0]: best = (score, xs.mean() * S + S / 2, cy * S + S / 2, len(pts))
        if best: fx, fy = best[1], best[2]
        else: fx, fy = (bb['x0'] + bb['x1']) / 2, bb['y0'] + (bb['y1'] - bb['y0']) * 0.18
        out[f"{c}-p{p['n']}"] = {'x': round(fx / 509 * 100, 1), 'y': round(fy / 556 * 100, 1)}
json.dump(out, open(os.path.join(ROOT, 'tools/face_auto.json'), 'w'), indent=1)
print(json.dumps(out))
