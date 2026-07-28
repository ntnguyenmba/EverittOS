'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/** Integrations is retired as a standalone Settings page. */
function IntegrationsRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = searchParams.toString();
    const hasQuickBooks = searchParams.has('quickbooks');
    const destination = hasQuickBooks
      ? `/invoices${params ? `?${params}` : ''}`
      : `/schedule${params ? `?${params}` : ''}`;
    router.replace(destination);
  }, [router, searchParams]);

  return (
    <main className="section">
      <div className="container">
        <div className="card">Redirecting…</div>
      </div>
    </main>
  );
}

export default function IntegrationsRedirectPage() {
  return (
    <Suspense
      fallback={
        <main className="section">
          <div className="container">
            <div className="card">Redirecting…</div>
          </div>
        </main>
      }
    >
      <IntegrationsRedirect />
    </Suspense>
  );
}
