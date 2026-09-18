'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const RECOVERY_KEY = 'everittos-global-error-recovery';

function safeSessionGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionSet(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* iOS / private mode must not block recovery */
  }
}

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
        await Promise.all(
          keys.filter((key) => key.startsWith('everittos-mobile-')).map((key) => caches.delete(key))
        );
      }
    } catch {
      // Recovery should still continue when browser cache APIs are unavailable.
    }

    try {
      const previous = safeSessionGet(RECOVERY_KEY);
      const now = Date.now();
      if (!previous || now - Number(previous) > 60_000) {
        safeSessionSet(RECOVERY_KEY, String(now));
        const url = new URL(window.location.href);
        url.searchParams.set('__everitt_recover', String(now));
        window.location.replace(url.toString());
        return;
      }
    } catch {
      // Fall through to Next's boundary reset.
    }

    setRecovering(false);
    try {
      reset();
    } catch {
      window.location.assign('/login');
    }
  }

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 32, maxWidth: 520, margin: '0 auto', color: '#1a202c' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Something went wrong</h2>
        <p style={{ margin: '0 0 8px', color: '#4a5568', lineHeight: 1.5 }}>
          We hit an unexpected error. Try again or return to sign in.
        </p>
        {error.digest ? (
          <p style={{ fontSize: 12, opacity: 0.65, margin: '0 0 16px' }}>Error reference: {error.digest}</p>
        ) : null}
        <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={recovering}
            onClick={() => void recover()}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              border: '1px solid #cbd5e0',
              background: recovering ? '#e2e8f0' : '#edf2f7',
              color: '#2b6cb0',
              fontWeight: 600,
              cursor: recovering ? 'wait' : 'pointer'
            }}
          >
            {recovering ? 'Reloading...' : 'Try again'}
          </button>
          <Link
            href="/login"
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              color: '#2d3748',
              textDecoration: 'none',
              fontWeight: 500
            }}
          >
            Sign in
          </Link>
        </div>
      </body>
    </html>
  );
}
