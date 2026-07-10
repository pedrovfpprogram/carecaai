const CACHE_NAME = 'carecaai-cache-v1';

// Quando o celular instala o app, ele guarda a página principal
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/']);
    })
  );
});

// Quando o app tentar carregar sem internet, ele não quebra
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match('/'))
  );
});