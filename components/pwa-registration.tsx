'use client';

import { useEffect } from 'react';

/**
 * Temporarily disable the service worker while the signed-in app is changing
 * quickly. Existing registrations/caches are removed so stale app shells cannot
 * trap users on a broken or old deploy.
 */
export function PwaRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister()))
      ).catch(() => undefined);
    }

    if ('caches' in window) {
      void caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith('everittos-mobile-')).map((key) => caches.delete(key)))
      ).catch(() => undefined);
    }
  }, []);

  return null;
}
