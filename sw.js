self.addEventListener('install', (e) => {
  console.log('[Service Worker] Instalado com sucesso.');
});

self.addEventListener('fetch', (e) => {
  // Apenas permite que o app funcione como PWA online
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
