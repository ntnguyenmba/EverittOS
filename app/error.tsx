'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Segment error boundary for every signed-in and public page under the root layout.
 * Catches render errors in owner / worker / client views without taking down the
 * entire document shell (global-error.tsx is the last resort for root-layout crashes).
 */
export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('EverittOS page error', error);
  }, [error]);

  return (
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: 32,
        maxWidth: 520,
        margin: '48px auto',
        color: '#1a202c'
      }}
    >
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
          onClick={() => reset()}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: '1px solid #cbd5e0',
            background: '#edf2f7',
            color: '#2b6cb0',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Try again
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
    </div>
  );
}
