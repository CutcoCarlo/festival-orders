import json, re, os, glob
from PIL import Image, ImageOps
cat = open('/Users/carlocipollina/cutco-offline-orders/catalog.js').read()
items = [json.loads(l.strip().rstrip(',')) for l in cat.splitlines() if l.strip().startswith('{"b":')]
def key(it): return it['b'] + it.get('sfx','') + (it['out'][0] if it.get('out') else '')
num2key = {}
for it in items:
    k = key(it); sfx = it.get('sfx','')
    cols = list(it['col']) if it.get('col') else ['']
    outs = it.get('out') or ['']
    for c in cols:
        for o in outs:
            for ch in (['', 'R'] if it.get('ch') else ['']):
                num2key[(it['b'] + (o or c) + sfx + ch).upper()] = k
boxes_all = json.load(open('ocr_boxes.json'))
os.makedirs('crops', exist_ok=True)
best = {}   # key -> (score, path)
unmatched = []
for fname, boxes in boxes_all.items():
    im = Image.open('all/' + fname).convert('RGB'); W, H = im.size
    colx = lambda b: 0 if b['x0'] < W/2 else 1
    adds = [b for b in boxes if 'add to cart' in b['t'].lower()]
    nums = [b for b in boxes if re.match(r'^[0-9]{3,4}[A-Z]{1,3}(-[0-9])?$|^#\s*[0-9A-Z][0-9A-Z\-]*$', b['t'].replace(' ', '').upper()) and '$' not in b['t']]
    bandtxt = [b['y1'] for b in boxes if b['t'].strip().lower() in ('value', 'customer pays', 'cpo')]
    bandbottom = (max(bandtxt) + 60) if bandtxt else 470
    for nb in nums:
        raw = nb['t'].replace(' ', '').upper().lstrip('#').rstrip('-')
        # OCR sometimes splits "#1737C-1" → "#1737C-" + "1" below: glue a lone short token right under it
        below = [b for b in boxes if colx(b) == colx(nb) and 0 <= b['y0'] - nb['y1'] < 60 and re.match(r'^[0-9A-Z]{1,3}$', b['t'].strip().upper())]
        cands = [raw] + ([raw + '-' + below[0]['t'].strip().upper()] if below else []) + [raw.replace('O', '0'), raw.replace('I', '1')]
        k = next((num2key[c] for c in cands if c in num2key), None)
        if not k: unmatched.append((fname, nb['t'])); continue
        c = colx(nb)
        prev = [a['y1'] for a in adds if colx(a) == c and a['y1'] < nb['y0']]
        CATS = ('STORAGE','COOKWARE','FLATWARE','GADGETS','ACCESSORIES','GARDENTOOLS','KITCHENTOOLS','GIFTSETS','SPECIALTYKNIVES','HOMEMAKERPIECES','PARTNERPRODUCTS','B-BLOCKSETS','BLOCKUPGRADESETS','KNIFESHEATHCOMBOS','TABLE/STEAKKNIFESETS','SPORTING/HUNTINGKNIVES','KITCHENCUTLERYSETS','BROWSEBYCATEGORY')
        heads = [b['y1'] for b in boxes if b['y1'] < nb['y0'] - 150 and b['x0'] < 120 and b['t'].replace(' ', '').upper() in CATS and b['y1'] > bandbottom - 80]
        top = max([bandbottom] + [p + 12 for p in prev] + [hh + 10 for hh in heads if not prev or hh > max(prev)])
        islogo = lambda b: re.match(r'^[A-Z]*CUTCO\.?$', b['t'].replace(' ', '').upper()) is not None
        names = [b for b in boxes if colx(b) == c and b['y1'] <= nb['y0'] + 5 and b['y0'] > max(top, nb['y0'] - 300) and 'add to cart' not in b['t'].lower() and b is not nb and not islogo(b)]
        bottom = (min(b['y0'] for b in names) - 8) if names else nb['y0'] - 70
        x0, x1 = (30, W//2 - 20) if c == 0 else (W//2 + 20, W - 30)
        if bottom - top < 200: continue
        reg = im.crop((x0, int(top), x1, int(bottom)))
        g = ImageOps.grayscale(reg)
        import numpy as np
        arr = np.array(g) < 238
        rows = arr.sum(axis=1)
        # find runs of rows with content; keep the tallest run (drops divider lines and small view icons)
        runs = []; start = None
        for yy, v in enumerate(rows):
            if v > 0 and start is None: start = yy
            if (v == 0 or yy == len(rows) - 1) and start is not None:
                runs.append((start, yy if v == 0 else yy + 1)); start = None
        runs = [r for r in runs if r[1] - r[0] >= 12]
        if not runs: continue
        r0, r1 = max(runs, key=lambda r: r[1] - r[0])
        # merge nearby runs (a gap of < 40px is still the same product, e.g. knife + sheath)
        for a, b2 in runs:
            if b2 >= r0 - 40 and a <= r1 + 40 and (b2 - a) >= 12 and not (a == r0): r0, r1 = min(r0, a), max(r1, b2)
        sub = arr[r0:r1]; cols_ = np.where(sub.sum(axis=0) > 0)[0]
        if len(cols_) == 0: continue
        bb = (int(cols_[0]), r0, int(cols_[-1]) + 1, r1)
        partial = (not prev) and bb[1] <= 2 and (bb[2] - bb[0]) > 0.6 * reg.width
        m = 14; box = (max(0, bb[0]-m), max(0, bb[1]-m), min(reg.width, bb[2]+m), min(reg.height, bb[3]+m))
        crop = reg.crop(box)
        score = (0 if partial else 1, crop.width * crop.height)
        if k not in best or score > best[k][0]:
            crop.thumbnail((320, 320)); p = f'crops/{k}.jpg'; crop.save(p, 'JPEG', quality=85); best[k] = (score, p)
print('matched keys', len(best), 'partial-only', sum(1 for s,_ in best.values() if s[0]==0))
print('unmatched', len(unmatched)); print(unmatched[:40])
missing = [key(it) for it in items if it['c'] not in ('services','custom') and key(it) not in best]
print('catalog items without a screenshot crop:', len(missing), missing)
json.dump({k: v[1] for k, v in best.items()}, open('crops_index.json','w'))
# review sheet
ks = sorted(k for k in best if any(k.startswith(p) for p in ('18','20','60','48','17','16','19','5725','5726','1711','1652'))); import math
per=48; 
for si in range(0, len(ks), per):
    batch = ks[si:si+per]; cols=8; rows=math.ceil(len(batch)/cols); sheet=Image.new('RGB',(cols*200, rows*230),'white')
    from PIL import ImageDraw; d=ImageDraw.Draw(sheet)
    for i,k in enumerate(batch):
        im=Image.open(best[k][1]); im.thumbnail((190,190)); x=(i%cols)*200; y=(i//cols)*230
        sheet.paste(im,(x+5,y+5)); d.text((x+5,y+205), k + ('' if best[k][0][0] else ' PARTIAL'), fill='red')
    sheet.save(f'crops_review{si//per}.png')
print('review sheets', math.ceil(len(ks)/per))
