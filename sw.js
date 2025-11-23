const CACHE_NAME = 'learning-srs-cache-v4'; // Updated: Don't cache API requests
const urlsToCache = [
  '/',
  '/index.html',
  '/index.tsx',
  // App assets
  '/manifest.json',
  '/icon.svg',
  // Key external dependencies from the importmap
  'https://esm.sh/@google/genai@^1.15.0',
  'https://esm.sh/react@^19.1.1',
  'https://esm.sh/react-dom@^19.1.1',
  'https://esm.sh/react-markdown@^9.0.1',
  'https://esm.sh/remark-gfm@^4.0.0'
];

self.addEventListener('install', event => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache).catch(error => {
          console.error('Failed to cache one or more essential resources during install:', error);
        });
      })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  // We only want to cache GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // NEVER cache API requests (backend or Gemini AI)
  const isApiRequest =
    url.hostname === 'localhost' || // localhost backend
    url.hostname.includes('vercel.app') || // deployed backend
    url.hostname.includes('supabase.co') || // Supabase
    url.hostname.includes('generativelanguage.googleapis.com'); // Gemini API

  if (isApiRequest) {
    // Pass through to network, don't cache
    event.respondWith(fetch(event.request));
    return;
  }

  // For navigation requests, use a network-first strategy.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // If the network fails, serve the main page from the cache.
        return caches.match('/');
      })
    );
    return;
  }

  // For static assets only, use a cache-first strategy.
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(response => {
        // Return from cache if found.
        if (response) {
          return response;
        }

        // Not in cache, fetch from network.
        return fetch(event.request).then(networkResponse => {
          // Only cache static resources (JS, CSS, images, fonts)
          if (networkResponse && networkResponse.status === 200) {
            const contentType = networkResponse.headers.get('content-type') || '';
            const isCacheable =
              contentType.includes('javascript') ||
              contentType.includes('css') ||
              contentType.includes('image') ||
              contentType.includes('font') ||
              url.hostname.includes('cdn.') || // CDN resources
              url.hostname.includes('esm.sh'); // ESM modules

            if (isCacheable) {
              const responseToCache = networkResponse.clone();
              cache.put(event.request, responseToCache);
            }
          }
          return networkResponse;
        }).catch(error => {
          console.error('Fetching failed:', error);
          throw error;
        });
      });
    })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});
