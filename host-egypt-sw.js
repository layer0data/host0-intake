/* HOST Egypt · offline helper (service worker), v4.1
   Lets HOST_Egypt.html (and the TEST page) open with no signal: the page, its settings file and the fonts are kept on the phone.
   - The page and its settings file: network first (a new version is picked up at once); after 5 seconds without an answer, or with no
     network, the copy on the phone opens instead, and the app shows its red bar.
   - Fonts: the copy on the phone first, refreshed in the background.
   - Everything else (the academy's Google Apps Script, the intake pages, any other file of this site) is NOT touched: it goes to the network
     exactly as without this file. Saves are never cached here; unsent work lives in the app's own outbox. */
const VERSION = 'host-egypt-sw-v4.1-1';
const OURS = ['HOST_Egypt.html', 'host-egypt-settings.js', 'HOST_Egypt_test.html', 'host-egypt-test-settings.js'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(VERSION).then(c => Promise.all(OURS.map(f => c.add(new Request(f, { cache: 'reload' })).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('host-egypt-sw-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
function ourFile(url) { if (url.origin !== self.location.origin) return null; const name = url.pathname.split('/').pop(); return OURS.indexOf(name) >= 0 ? name : null; }
self.addEventListener('fetch', ev => {
  const req = ev.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const mine = ourFile(url);
  if (mine) {
    ev.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const net = fetch(req).then(r => { if (r && r.ok) cache.put(mine, r.clone()); return r; });
      const timer = new Promise(res => setTimeout(() => res(null), 5000));
      try { const r = await Promise.race([net, timer]); if (r && r.ok) return r; } catch (e) { }
      const kept = await cache.match(mine); if (kept) return kept;
      return net;                                             // nothing kept yet: wait for the network after all
    })());
    return;
  }
  if (FONT_HOSTS.indexOf(url.hostname) >= 0) {
    ev.respondWith((async () => {
      const cache = await caches.open(VERSION); const kept = await cache.match(req);
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone()); return r; }).catch(() => null);
      return kept || (await net) || Response.error();
    })());
  }
});
