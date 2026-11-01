# face_final.json(없으면 face_auto.json) 의 앵커를 이미지 위에 찍어 handoff_v2/pose_verify/verify_*.png 생성
import json, os
from PIL import Image, ImageDraw
ROOT = os.path.join(os.path.dirname(__file__), '..')
meta = json.load(open(os.path.join(ROOT, 'handoff_v2/pose_meta_draft.json'), encoding='utf-8'))
fp = os.path.join(ROOT, 'tools/face_final.json')
fa = json.load(open(fp if os.path.exists(fp) else os.path.join(ROOT, 'tools/face_auto.json')))
for c, v in meta['characters'].items():
    sheet = Image.new('RGB', (509 * 3, 556 * 2), (236, 228, 216)); d = ImageDraw.Draw(sheet)
    for i, p in enumerate(sorted(v['poses'], key=lambda q: q['n'])):
        im = Image.open(os.path.join(ROOT, 'dist', p['file'])).convert('RGBA'); ox, oy = (i % 3) * 509, (i // 3) * 556
        sheet.paste(im, (ox, oy), im); b = p['bbox']
        d.rectangle([ox + b['x0'], oy + b['y0'], ox + b['x1'], oy + b['y1']], outline=(0, 120, 255), width=2)
        k = f"{c}-p{p['n']}"; a = fa[k]; x, y = ox + a['x'] / 100 * 509, oy + a['y'] / 100 * 556
        d.ellipse([x - 9, y - 9, x + 9, y + 9], outline=(255, 0, 0), width=4); d.line([x - 16, y, x + 16, y], fill=(255, 0, 0), width=2); d.line([x, y - 16, x, y + 16], fill=(255, 0, 0), width=2)
        d.rectangle([ox + 4, oy + 4, ox + 230, oy + 28], fill=(255, 255, 255)); d.text((ox + 8, oy + 10), f"{k} {p['role']} face=({a['x']},{a['y']}) vis={p.get('faceVisible', True)}", fill=(200, 0, 0))
    sheet.resize((sheet.width * 2 // 3, sheet.height * 2 // 3)).save(os.path.join(ROOT, 'handoff_v2/pose_verify', f'verify_{c}.png'))
print('ok')
