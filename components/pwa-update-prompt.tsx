'use client';

import { useEffect, useState } from 'react';

/** Prompts users when a new service worker is waiting, without reloading during form entry. */
export function PwaUpdatePrompt() {
  const [waiting, setWaiting] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let cancelled = false;

    async function bind() {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg || cancelled) return;

      setRegistration(reg);

      if (reg.waiting) {
        setWaiting(true);
      }

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;

        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            setWaiting(true);
          }
        });
      });
    }

    void bind();

    const onControllerChange = () => {
      setWaiting(false);
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  if (!waiting) return null;

  function applyUpdate() {
    const activeForms = document.querySelectorAll('form[data-unsaved="true"]');
    if (activeForms.length > 0) {
      const proceed = window.confirm('A new version is available. Reload now? Unsaved form changes may be lost.');
      if (!proceed) return;
    }

    registration?.waiting?.postMessage('SKIP_WAITING');
    window.location.reload();
  }

  return (
    <div className="pwa-update-banner" role="status" aria-live="polite">
      <span>A new version of EverittOS is available.</span>
      <button type="button" className="btn btn-sm" onClick={applyUpdate}>
        Refresh
      </button>
    </div>
  );
}
