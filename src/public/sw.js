// Service Worker — Dashboard PWA
// Cache minimal pour permettre l'installation et le fonctionnement offline basique

const CACHE_NAME = 'dashboard-v1';

// Ressources à mettre en cache au premier chargement
const PRECACHE_URLS = [
  '/',
  '/static/css/style.css',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
];

// Installation : précache les ressources de base
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activation : supprime les anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch : Network first (l'app est dynamique, on ne veut pas servir du vieux contenu)
// Fallback cache uniquement si réseau indisponible
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ne pas intercepter les requêtes API ni SSE
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Ne pas intercepter les requêtes non-GET
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Mettre en cache les ressources statiques
        if (response.ok && (
          url.pathname.startsWith('/static/') ||
          url.pathname === '/' ||
          url.pathname === '/manifest.json'
        )) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Fallback cache si hors ligne
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Fallback page principale si navigation hors ligne
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Hors ligne', { status: 503 });
        });
      })
  );
});
