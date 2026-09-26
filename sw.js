/* Offline cache so the app opens with no signal. Files are served cache-first and refreshed in the
   background; bump VERSION on each release so phones swap to the new files on the next launch. */
importScripts('imglist.js');
const VERSION = 'orders-v17';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'catalog.js', 'taxrates.js', 'imglist.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(async c => {
    await c.addAll(SHELL);
    const sheets = (typeof IMG_SPRITES !== 'undefined' && IMG_SPRITES.sheets) || [];
    await Promise.all(sheets.map(u => c.add(u).catch(() => {})));
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const put = res => { if (res && res.ok) caches.open(VERSION).then(c => c.put(e.request, res.clone())); return res; };
  // Cache-first: open instantly from the saved copy (no waiting on a dead signal), refresh the copy in the
  // background when the network answers. A new sw.js VERSION still swaps everything on the next launch.
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(cached => {
    const net = fetch(e.request, { cache: 'no-cache' }).then(put).catch(() => null);
    if (cached) { e.waitUntil(net.catch(() => {})); return cached; }
    return net.then(r => r || Response.error());
  }));
});
