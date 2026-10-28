// À incrémenter à chaque déploiement, sinon l'iPhone garde l'ancienne version en cache.
const CACHE = 'marecolte-v1';
const FICHIERS = [
  './', './index.html', './style.css', './app.js', './domain.js',
  './manifest.webmanifest', './icon-180.png', './icon-512.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(caches.keys()
    .then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (ev) => {
  ev.respondWith(caches.match(ev.request, { ignoreSearch: true }).then((r) => r ?? fetch(ev.request)));
});
