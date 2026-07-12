const SW_VERSION = 'everittos-mobile-v1';
const STATIC_CACHE = `${SW_VERSION}-static`;

const STATIC_ASSETS = ['/offline.html', '/manifest.webmanifest', '/favicon.ico'];

const NEVER_CACHE_PREFIXES = [
  '/api/',
  '/auth/',
  '/confirm-email',
  '/reset-password',
  '/login',
  '/signup',
  '/forgot-password',
  '/settings/billing'
];

const NEVER_CACHE_HOSTS = ['supabase.co', 'stripe.com', 'google-analytics.com', 'googletagmanager.com'];

function shouldNeverCache(url) {
  if (!url) return true;

  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith('/api/')) return true;
    if (NEVER_CACHE_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix))) return true;
    if (NEVER_CACHE_HOSTS.some((host) => parsed.hostname.includes(host))) return true;
    if (parsed.search.includes('token=') || parsed.search.includes('code=')) return true;
  } catch {
    return true;
  }

  return false;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith('everittos-mobile-') && key !== STATIC_CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = request.url;
  if (shouldNeverCache(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(async () => {
          const cache = await caches.open(STATIC_CACHE);
          const offline = await cache.match('/offline.html');
          return offline || Response.error();
        })
    );
    return;
  }

  if (url.includes('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
