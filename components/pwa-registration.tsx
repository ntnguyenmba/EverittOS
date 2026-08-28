'use client';

import { useEffect } from 'react';

const RELOAD_GUARD = 'everittos-sw-reloaded';

/** Register EverittOS PWA support and immediately pick up newly deployed app assets. */
export function PwaRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    let disposed = false;

    const onControllerChange = () => {
      if (disposed) return;
      if (window.sessionStorage.getItem(RELOAD_GUARD) === '1') return;
      window.sessionStorage.setItem(RELOAD_GUARD, '1');
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    void navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(async (registration) => {
        await registration.update().catch(() => undefined);

        if (registration.waiting) {
          registration.waiting.postMessage('SKIP_WAITING');
        }

        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage('SKIP_WAITING');
            }
          });
        });
      })
      .catch(() => {
        // PWA support is optional; the web app remains usable without it.
      });

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
