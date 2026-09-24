import glob, json, re, os, sys
from rapidocr_onnxruntime import RapidOCR
from PIL import Image
ocr = RapidOCR()
out = {}
files = sorted(glob.glob('all/*.PNG'))
for f in files:
    res, _ = ocr(f)
    if not res: continue
    boxes = []
    for pts, txt, conf in res:
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        boxes.append({'x0': min(xs), 'y0': min(ys), 'x1': max(xs), 'y1': max(ys), 't': txt.strip(), 'c': conf})
    n_add = sum(1 for b in boxes if 'add to cart' in b['t'].lower())
    if n_add < 2: 
        print(os.path.basename(f), 'skip (not a grid)'); continue
    out[os.path.basename(f)] = boxes
    print(os.path.basename(f), len(boxes), 'boxes', n_add, 'add-to-cart')
json.dump(out, open('ocr_boxes.json', 'w'))
