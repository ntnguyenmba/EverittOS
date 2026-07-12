'use client';

import { useEffect } from 'react';

/** Registers the EverittOS service worker on supported web browsers. */
export function PwaRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    void navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(() => {
        // Registration can fail on unsupported origins or during local development.
      });
  }, []);

  return null;
}
