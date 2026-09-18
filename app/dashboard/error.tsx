'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('EverittOS owner dashboard error', error);
  }, [error]);

  return (
    <div className="card" style={{ maxWidth: 520, margin: '32px auto', padding: 24 }}>
      <h2>Something went wrong</h2>
      <p className="muted">We hit an unexpected error on the owner dashboard. Try again or return to sign in.</p>
      <div className="button-row" style={{ marginTop: 16, display: 'flex', gap: 12 }}>
        <button type="button" className="btn btn-primary" onClick={() => reset()}>
          Try again
        </button>
        <Link className="btn" href="/login">
          Sign in
        </Link>
      </div>
    </div>
  );
}
