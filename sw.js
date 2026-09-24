/* Offline cache so the app opens with no signal. App files are network-first so
   updates show up on the next load with signal. Bump VERSION on each release. */
importScripts('imglist.js');
const VERSION = 'orders-v11';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'catalog.js', 'taxrates.js', 'imglist.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(async c => {
    await c.addAll(SHELL);
    await Promise.all(((self.IMG_SPRITES && IMG_SPRITES.sheets) || []).map(u => c.add(u).catch(() => {})));
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const put = res => { if (res && res.ok) caches.open(VERSION).then(c => c.put(e.request, res.clone())); return res; };
  if (url.pathname.includes('/sprites/')) { e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(put))); return; }
  e.respondWith(fetch(e.request).then(put).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
