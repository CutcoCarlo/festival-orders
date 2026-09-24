# Festival Orders

Offline-first order capture for Cutco festival/booth sales, modeled on the Cutco Orders app.
Works with no cell signal; orders are saved on the phone until you are back on signal and can
enter them in the real Cutco app. Pure static site: no build step, no server.

Files: `index.html`, `style.css`, `app.js` (screens, storage, PIN/encryption, signature pad, tax lookup),
`catalog.js` (GENERATED from `tools/build_catalog.py`: products, retail + business-gift prices, CPO, points, colors),
`taxrates.js` (California city/county rates + ZIP-to-county for offline estimates), `imglist.js` + `sprites/` (product photos packed into
two sprite sheets by `tools/build_sprites.py`; source photos in `tools/img_src`, from images.cutco.com/products/shop/h/<item#>.jpg),
`sw.js` (offline cache), `manifest.webmanifest`, `icons/`.

Item picker: category chips → photo grid → tap a tile → options sheet (set variants from FAMILIES in catalog.js, handle color,
block finish, quantity, price, free/bonus, note) → Add to Order. Cart button in the header opens the cart page; tapping a
line reopens the options sheet to edit or remove it.

Pricing / CPO: exact price, CPO and points from the L21 U.S. Price List (Mar 2026, parsed into `tools/l21_2026.json`); business-gift prices from the CGP Gifting
Price List (Aug 2026) and Auxiliary Price List (Mar 2026). Items with no 2026 source carry `e` (estimated from 2019 ratios).
CPO = sum of CPO of paid items minus point value of free (bonus) items. Business/Realtor orders use gift prices,
the P.P.S.&I. shipping table and can use 6-pay.

Updating prices / new products: edit the tables in `tools/build_catalog.py`, run it (needs Python 3), upload the new
`catalog.js`, bump `VERSION` in `sw.js`. Quick one-off price fixes can be made on the phone in Settings.

Sales tax: exact rate per ship-to address when online (ArcGIS geocoder + CDTFA tax-area map, both keyless);
offline it estimates from the city table, then the ZIP-to-county table, then the fallback rate. The city/county table
refreshes itself from the CDTFA map when online (weekly, or Settings → Refresh).

Security: a PIN is required to open the app. Card number and expiration are encrypted on the phone
with a key derived from the PIN (Web Crypto, PBKDF2 + AES-GCM). Card data is never included in
emails or backups, and is wiped when an order is marked "Entered in Cutco".

Deploy: upload everything to a GitHub repo with Pages enabled (main / root). Must be served over
https (GitHub Pages is) for the encryption to be available. Bump `VERSION` in `sw.js` on every release.

Install on iPhone: open the site in Safari → Share → Add to Home Screen. Open it once with signal
so it caches; after that it opens offline.
