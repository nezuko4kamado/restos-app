// Service Worker per PWA - Restaurant Manager
// CACHE_NAME versioned to force cache invalidation on every deploy
const CACHE_NAME = 'restaurant-manager-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event - cache only essential static resources, NOT JS bundles
self.addEventListener('install', (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('✅ Cache aperta v3');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - NEVER cache JS/CSS assets (always fetch from network)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Always fetch JS and CSS from network (no cache)
  if (url.pathname.startsWith('/assets/') || 
      url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.css')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For other resources: cache first, fallback to network
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Activate event - clean up ALL old caches and take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Delete ALL old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ])
  );
});
