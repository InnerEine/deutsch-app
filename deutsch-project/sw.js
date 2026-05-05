const CACHE_NAME = 'deutsch-app-v3';
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './js/boot.js',
  './js/data.js',
  './js/config.js',
  './js/state.js',
  './js/onboarding.js',
  './js/app.js',
  './js/practice.js',
  './manifest.json',
  './favicon.svg',
  './icon-192.svg',
  './icon-512.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.pathname.includes('/api/')) return;

  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
