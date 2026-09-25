'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BrandLogo } from '@/components/brand-logo';
import { PricingCheckoutPanel } from '@/components/pricing-checkout-panel';
import { useTranslation } from '@/components/locale-provider';
import { performClientLogout } from '@/lib/client-logout';
import { normalizePlan } from '@/lib/everittos-plans';
import { supabase } from '@/lib/supabase';

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const selectedPlan = normalizePlan(searchParams.get('plan'));
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
    <main id="main-content" className="section eo-document pricing-public-page">
      <div className="container" style={{ maxWidth: 1080 }}>
        <nav className="pricing-public-nav" aria-label="Pricing navigation">
          <BrandLogo href="/" size={36} showName />
          <div className="pricing-public-nav-links">
            {authenticated ? (
              <>
                <Link href="/dashboard">{t('billing.pricingNav.dashboard')}</Link>
                <Link href="/settings/billing">{t('billing.pricingNav.billing')}</Link>
                <Link href="/settings/account">{t('billing.pricingNav.account')}</Link>
                <button type="button" className="pricing-public-nav-button" onClick={() => void performClientLogout(router)}>
                  {t('ux.logOut')}
                </button>
              </>
            ) : (
              <>
                <Link href="/login?next=/pricing">{t('billing.pricingNav.signIn')}</Link>
                <Link className="btn btn-primary pricing-public-nav-cta" href="/signup">
                  {t('billing.pricingNav.createAccount')}
                </Link>
              </>
            )}
          </div>
        </nav>

        <header className="pricing-public-header">
          <p className="muted pricing-public-eyebrow">EverittOS</p>
          <h1>{t('billing.pricingTitle')}</h1>
          <p className="muted pricing-public-lead">{t('billing.pricingPublicLead')}</p>
        </header>

        {authChecked ? (
          <PricingCheckoutPanel
            selectedPlan={selectedPlan === 'free' ? 'pro' : selectedPlan}
            authenticated={authenticated}
          />
        ) : (
          <p className="muted">{t('billing.pricingLoading')}</p>
        )}

        <footer className="pricing-public-footer muted">
          <Link href="/terms">{t('legal.terms')}</Link> · <Link href="/privacy">{t('legal.privacy')}</Link> ·{' '}
          <Link href="/cookies">{t('legal.cookies')}</Link>
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
