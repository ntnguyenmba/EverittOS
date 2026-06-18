'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PricingCheckoutPanel } from '@/components/pricing-checkout-panel';
import { NoRefundDisclosure } from '@/components/legal/no-refund-disclosure';
import { OnboardingSupportPromo } from '@/components/onboarding-support-promo';
import { normalizePlan } from '@/lib/everittos-plans';
import { supabase } from '@/lib/supabase';

function PricingContent() {
  const searchParams = useSearchParams();
  const selectedPlan = normalizePlan(searchParams.get('plan'));
  const initialPromo = (searchParams.get('promo') || '').trim();
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!cancelled) {
        setAuthenticated(Boolean(user));
        setAuthChecked(true);
      }
    }

    void checkAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main id="main-content" className="section pricing-public-page">
      <div className="container" style={{ maxWidth: 1080 }}>
        <header className="pricing-public-header">
          <p className="muted pricing-public-eyebrow">EverittOS</p>
          <h1>Plans and pricing</h1>
          <p className="muted pricing-public-lead">
            Compare plans side by side. Start free or upgrade when you are ready — subscriptions renew monthly until
            canceled.
          </p>
        </header>

        <NoRefundDisclosure variant="card" className="pricing-public-policy" />

        {authChecked ? (
          <PricingCheckoutPanel
            selectedPlan={selectedPlan === 'free' ? 'pro' : selectedPlan}
            initialPromoCode={initialPromo}
            authenticated={authenticated}
          />
        ) : (
          <p className="muted">Loading plans…</p>
        )}

        <OnboardingSupportPromo variant="pricing" />

        <footer className="pricing-public-footer muted">
          <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> ·{' '}
          <Link href="/refund-policy">No Refund Policy</Link> · <Link href="/cookies">Cookies</Link>
        </footer>
      </div>
    </main>
  );
}

export default function PricingPage() {
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  );
}
