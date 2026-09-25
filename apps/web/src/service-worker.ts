/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;
const cacheName = `replyra-static-${version}`;
// Only public application assets are cached. API responses, auth callbacks,
// and user pages always use the network.
const assets = [...build, ...files.filter((file) =>
  ['/offline.html', '/manifest.webmanifest', '/replyra-icon-1024.png'].includes(file)
)];
const assetPaths = new Set(assets);

worker.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(assets)));
});

worker.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('replyra-static-') && key !== cacheName) await caches.delete(key);
    }
    await worker.clients.claim();
  })());
});

worker.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== worker.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () =>
      (await caches.match('/offline.html')) ?? new Response('Offline', { status: 503 })
    ));
  } else if (assetPaths.has(url.pathname)) {
    event.respondWith(caches.open(cacheName).then(async (cache) =>
      (await cache.match(request)) ?? fetch(request)
    ));
  }
});
