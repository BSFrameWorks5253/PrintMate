// PrintMate Offline Service Worker
const CACHE_NAME = 'printmate-cache-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/logo.svg',
  '/icons.svg'
];

// 1. Install & precache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Pre-caching warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate & clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Strategy: Network-first for HTML, Stale-while-revalidate for JS/CSS/Images
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignore non-GET or chrome-extension requests
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  const url = new URL(request.url);

  // Bypass cloud API requests (Supabase, external telemetry)
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // A. Navigation requests: Network first with index.html fallback for full SPA offline support
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match('/index.html') || await caches.match('/');
          if (cachedResponse) return cachedResponse;
          return new Response('PrintMate is offline. Please reconnect to load updates.', {
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
    return;
  }

  // B. Static Assets: Cache first with network fallback & background refresh (Stale-While-Revalidate)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
