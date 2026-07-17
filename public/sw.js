// Service worker de Simone — permet l'installation (PWA) et le fonctionnement
// hors-ligne. Aucune donnée n'est envoyée nulle part : ce cache ne fait que
// stocker localement l'application et ses ressources déjà chargées.

const CACHE = 'simone-cache-v1';

// Coquille de l'app pré-mise en cache dès l'installation → le document est
// disponible hors-ligne même après un simple rechargement.
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Résilient : un fichier manquant n'empêche pas l'installation.
      await Promise.allSettled(SHELL.map((u) => cache.add(u)));
    })(),
  );
  // Le nouveau worker prend la main sans attendre la fermeture des onglets.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Nettoie les anciens caches d'une version précédente.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// Les documents HTML : réseau d'abord (pour recevoir les mises à jour), repli
// sur le cache hors-ligne. Le reste (JS/CSS/icônes, worker pdf.js, données OCR)
// est aux noms versionnés ou stables : cache d'abord, mise à jour en arrière-plan.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // on ne touche pas aux tiers

  const isDoc = request.mode === 'navigate' || request.destination === 'document';

  if (isDoc) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('./index.html'))),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
