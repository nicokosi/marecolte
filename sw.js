// À incrémenter à chaque déploiement, sinon l'iPhone garde l'ancienne version en cache.
const CACHE = 'marecolte-v1';
const FICHIERS = [
  './', './index.html', './style.css', './app.js', './domain.js',
  './manifest.webmanifest', './icon-180.png', './icon-512.png',
];

// cache: 'reload' contourne le cache HTTP (max-age=600 sur GitHub Pages), sinon v2 pourrait stocker les fichiers de v1.
self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(caches.keys()
    .then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (ev) => {
  ev.respondWith(caches.match(ev.request, { ignoreSearch: true }).then((r) => r ?? fetch(ev.request)));
});
