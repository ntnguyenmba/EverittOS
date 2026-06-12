'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { PricingCheckoutPanel } from '@/components/pricing-checkout-panel';
import { useTranslation } from '@/components/locale-provider';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

function PricingContent() {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<'owner' | 'admin' | 'manager' | 'employee' | 'contractor' | 'client' | 'viewer'>('owner');
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const selectedPlan = normalizePlan(searchParams.get('plan'));
  const initialPromo = (searchParams.get('promo') || '').trim();

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        setAuthenticated(false);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));
      setRole(normalizeRole(profile?.role));
      setAuthenticated(true);
      setLoading(false);
    }

    void load();
  }, []);

  if (loading) {
    return <p className="loading-state">{t('common.loading')}</p>;
  }

  return (
    <AppShell plan={plan} role={role} showBackButton={false}>
      <PageHeader title={t('billing.pricingTitle')} subtitle={t('billing.pricingSubtitle')} />
      <PricingCheckoutPanel
        selectedPlan={selectedPlan === 'free' ? 'pro' : selectedPlan}
        initialPromoCode={initialPromo}
        authenticated={authenticated}
      />
      {!authenticated ? (
        <p className="muted pricing-signin-note">
          {t('billing.promo.signInNote')}{' '}
          <Link href={`/login?next=${encodeURIComponent('/pricing')}`}>Sign in</Link>
        </p>
      ) : null}
    </AppShell>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<p className="loading-state">Loading…</p>}>
      <PricingContent />
    </Suspense>
  );
}
