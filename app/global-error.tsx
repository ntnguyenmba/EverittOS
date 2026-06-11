'use client';

import Link from 'next/link';

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 32, maxWidth: 520 }}>
        <h2>Something went wrong</h2>
        <p>We hit an unexpected error. Try again or return to the home page.</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button type="button" onClick={() => reset()} style={{ padding: '8px 16px' }}>
            Try again
          </button>
          <Link href="/" style={{ padding: '8px 16px' }}>
            Home
          </Link>
        </div>
      </body>
    </html>
  );
}
