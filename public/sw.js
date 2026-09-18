/* EverittOS service-worker kill switch.
   The signed-in app changes frequently and must never be trapped behind an old
   cached shell. This worker removes legacy EverittOS caches, releases clients,
   and unregisters itself. */
const CACHE_PREFIX = 'everittos-mobile-';

async function cleanEverittCaches() {
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => caches.delete(key)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await cleanEverittCaches();
      await self.clients.claim();
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: 'EVERITTOS_SW_REMOVED' });
      }
    })()
  );
});

self.addEventListener('fetch', () => {
  // Intentionally do not intercept requests.
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') void self.skipWaiting();
});
