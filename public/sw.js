// PrintMate Self-Clearing Service Worker
// Automatically purges old caches, unregisters itself, and allows the latest Vite bundle to load directly from the network.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => {
      return self.registration.unregister();
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', () => {
  // Pass all requests straight to the network without caching
  return;
});
