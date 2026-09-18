'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const RECOVERY_KEY = 'everittos-global-error-recovery';

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    console.error('EverittOS global error', error);
  }, [error]);

  async function recover() {
    setRecovering(true);

    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }

      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith('everittos-mobile-')).map((key) => caches.delete(key)));
      }
    } catch {
      // Recovery should still continue when browser cache APIs are unavailable.
    }

    try {
      const previous = window.sessionStorage.getItem(RECOVERY_KEY);
      const now = Date.now();
      if (!previous || now - Number(previous) > 60_000) {
        window.sessionStorage.setItem(RECOVERY_KEY, String(now));
        const url = new URL(window.location.href);
        url.searchParams.set('__everitt_recover', String(now));
        window.location.replace(url.toString());
        return;
      }
    } catch {
      // Fall through to Next's boundary reset.
    }

    setRecovering(false);
    reset();
  }

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 32, maxWidth: 520 }}>
        <h2>Something went wrong</h2>
        <p>EverittOS hit an unexpected error. Try again to reload the current page safely.</p>
        {error.digest ? <p style={{ fontSize: 12, opacity: 0.65 }}>Error reference: {error.digest}</p> : null}
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button type="button" disabled={recovering} onClick={() => void recover()} style={{ padding: '8px 16px' }}>
            {recovering ? 'Reloading...' : 'Try again'}
          </button>
          <Link href="/login" style={{ padding: '8px 16px' }}>
            Sign in
          </Link>
        </div>
      </body>
    </html>
  );
}
