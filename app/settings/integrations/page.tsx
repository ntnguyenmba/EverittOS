'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';

const copy = {
  en: { redirecting: 'Redirecting…' },
  es: { redirecting: 'Redirigiendo…' },
  vi: { redirecting: 'Đang chuyển hướng…' }
} as const;

/** Integrations is retired as a standalone Settings page. */
function IntegrationsRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useTranslation();
  const c = copy[locale] || copy.en;

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
        <div className="card">{c.redirecting}</div>
      </div>
    </main>
  );
}

function RedirectFallback() {
  const { locale } = useTranslation();
  const c = copy[locale] || copy.en;
  return (
    <main className="section">
      <div className="container">
        <div className="card">{c.redirecting}</div>
      </div>
    </main>
  );
}

export default function IntegrationsRedirectPage() {
  return (
    <Suspense fallback={<RedirectFallback />}>
      <IntegrationsRedirect />
    </Suspense>
  );
}
