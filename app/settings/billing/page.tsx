'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccessBlockedBanner } from '@/components/access-blocked-banner';
import { AppShell } from '@/components/app-shell';
import { SettingsShell } from '@/components/settings/settings-shell';
import { AiUsagePanel } from '@/components/ai-usage-panel';
import { UsageDashboard } from '@/components/usage-dashboard';
import { mapAccessError } from '@/lib/auth-errors';
import { BillingPlansGrid } from '@/components/billing-plans-grid';
import { SUPPORT_EMAIL, supportMailtoHref } from '@/lib/support';
import { formatCouponDuration } from '@/lib/stripe-promo';
import { normalizePlan, planDisplayName, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizeRole } from '@/lib/roles';
import { fetchUsageCounts } from '@/lib/everittos-usage';
import { canResumeSubscription } from '@/lib/stripe-subscription';
import { subscriptionAccess } from '@/lib/subscription-access';
import { useTranslation } from '@/components/locale-provider';
import { supabase } from '@/lib/supabase';

function BillingSettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const upgradePlan = normalizePlan(searchParams.get('upgrade'));

  const accessNotice = useMemo(() => {
    const reason = searchParams.get('reason');
    const detail = searchParams.get('detail');
    const status = searchParams.get('status');
    if (reason === 'plan') {
      const mapped = mapAccessError('plan');
      return { ...mapped, details: detail || mapped.details };
    }
    if (reason === 'subscription') {
      const mapped = mapAccessError('subscription');
      return {
        ...mapped,
        message: status ? subscriptionAccess(upgradePlan, status).message : mapped.message,
        details: detail || status || mapped.details
      };
    }
    return null;
  }, [searchParams, upgradePlan]);

  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState(normalizeRole('owner'));
  const [usage, setUsage] = useState({
    jobs: 0,
    photos: 0,
    customers: 0,
    reports: 0,
    workers: 0,
    teamMembers: 1,
    locations: 0
  });
  const [subscriptionStatus, setSubscriptionStatus] = useState('free');
  const [stripeCustomerId, setStripeCustomerId] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [stripeCapabilities, setStripeCapabilities] = useState<{
    checkout: boolean;
    portal: boolean;
    resume: boolean;
  } | null>(null);
  const [couponName, setCouponName] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponPercentOff, setCouponPercentOff] = useState<number | null>(null);
  const [couponAmountOff, setCouponAmountOff] = useState<number | null>(null);
  const [couponDuration, setCouponDuration] = useState<string | null>(null);
  const [couponDurationInMonths, setCouponDurationInMonths] = useState<number | null>(null);
  const [couponExpiresAt, setCouponExpiresAt] = useState<string | null>(null);

  const checkoutPlan = normalizePlan(searchParams.get('upgrade') || searchParams.get('plan'));

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/settings/billing');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select(
          'plan, role, subscription_status, stripe_customer_id, stripe_promotion_code, coupon_name, coupon_percent_off, coupon_amount_off, coupon_duration, coupon_duration_in_months, coupon_expires_at'
        )
        .eq('id', user.id)
        .maybeSingle();

      const resolvedPlan = normalizePlan(profile?.plan);
      setPlan(resolvedPlan);
      setRole(normalizeRole(profile?.role || 'owner'));
      setSubscriptionStatus(profile?.subscription_status || 'free');
      setStripeCustomerId(profile?.stripe_customer_id || '');
      setCouponCode(profile?.stripe_promotion_code || null);
      setCouponName(profile?.coupon_name || null);
      setCouponPercentOff(profile?.coupon_percent_off != null ? Number(profile.coupon_percent_off) : null);
      setCouponAmountOff(profile?.coupon_amount_off != null ? Number(profile.coupon_amount_off) : null);
      setCouponDuration(profile?.coupon_duration || null);
      setCouponDurationInMonths(
        profile?.coupon_duration_in_months != null ? Number(profile.coupon_duration_in_months) : null
      );
      setCouponExpiresAt(profile?.coupon_expires_at || null);

      const { data: subscription } = await supabase
        .from('everittos_subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscription?.status && !profile?.subscription_status) setSubscriptionStatus(subscription.status);

      const org = await fetchOrganizationContext(user.id).catch(() => null);
      const counts = await fetchUsageCounts(user.id, org?.organizationId).catch(() => usage);
      setUsage(counts);

      const capsRes = await fetch('/api/stripe/capabilities', { cache: 'no-store' }).catch(() => null);
      if (capsRes?.ok) {
        const caps = await capsRes.json();
        setStripeCapabilities({
          checkout: Boolean(caps.checkout),
          portal: Boolean(caps.portal),
          resume: Boolean(caps.resume)
        });
      }

      setLoading(false);
    }

    void load();
  }, [router]);

  async function openBillingPortal() {
    setPortalLoading(true);
    setMessage('');
    const res = await fetch('/api/stripe/portal', { method: 'POST' });
    const json = await res.json();
    setPortalLoading(false);

    if (!res.ok) {
      setMessage(res.status === 503 ? t('billing.portalNotConfigured') : json.error || 'Unable to open billing portal.');
      return;
    }

    window.location.href = json.url;
  }

  async function resumeSubscription() {
    setResumeLoading(true);
    setMessage('');
    const res = await fetch('/api/stripe/resume-subscription', { method: 'POST' });
    const json = await res.json();
    setResumeLoading(false);

    if (!res.ok) {
      setMessage(json.error || 'Unable to resume subscription.');
      return;
    }

    setSubscriptionStatus(json.status || 'active');
    setMessage(json.message || 'Subscription resumed.');
  }

  if (loading) {
    return (
      <AppShell plan={plan} role={role}>
        <p>Loading billing...</p>
      </AppShell>
    );
  }

  const canOpenPortal = Boolean(stripeCustomerId && stripeCapabilities?.portal);
  const showPortalCancel = canOpenPortal && plan !== 'free' && subscriptionStatus !== 'canceled';

  return (
    <SettingsShell plan={plan} role={role} title={t('billing.title')} description={t('billing.description')}>
      {accessNotice ? (
        <AccessBlockedBanner title={accessNotice.title} message={accessNotice.message} details={accessNotice.details} />
      ) : null}
      {searchParams.get('checkout') === 'success' ? (
        <p className="auth-message auth-message-success">{t('billing.promo.checkoutSuccess')}</p>
      ) : null}
      {searchParams.get('checkout') === 'cancelled' ? (
        <p className="auth-message auth-message-error">{t('billing.promo.checkoutCancelled')}</p>
      ) : null}
      {searchParams.get('upgrade') ? (
        <div className="settings-warning" style={{ marginBottom: 18 }}>
          {planDisplayName(upgradePlan)} or higher is required for that page. Choose a plan below to upgrade.
        </div>
      ) : null}

      {couponName ? (
        <div className="settings-card promo-active-discount">
          <h3>{t('billing.promo.activeTitle')}</h3>
          <div className="settings-row">
            <span className="settings-row-label">{t('billing.promo.couponName')}</span>
            <span className="settings-row-value">{couponName}</span>
          </div>
          {couponCode ? (
            <div className="settings-row">
              <span className="settings-row-label">{t('billing.promo.code')}</span>
              <span className="settings-row-value">{couponCode}</span>
            </div>
          ) : null}
          <div className="settings-row">
            <span className="settings-row-label">{t('billing.promo.discount')}</span>
            <span className="settings-row-value">
              {formatCouponDuration(
                (couponDuration as 'forever' | 'once' | 'repeating') || 'once',
                couponDurationInMonths,
                couponPercentOff,
                couponAmountOff
              )}
            </span>
          </div>
          {couponExpiresAt ? (
            <div className="settings-row">
              <span className="settings-row-label">{t('billing.promo.expiresLabel')}</span>
              <span className="settings-row-value">
                {new Date(couponExpiresAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="settings-card">
        <h3>Current plan</h3>
        <div className="settings-row">
          <span className="settings-row-label">{t('billing.currentPlan')}</span>
          <span className="settings-row-value">{planDisplayName(plan)}</span>
        </div>

        <div className="settings-actions">
          {canOpenPortal ? (
            <button type="button" className="btn btn-primary" disabled={portalLoading} onClick={openBillingPortal}>
              {portalLoading ? 'Opening...' : t('billing.manageBilling')}
            </button>
          ) : null}
          {showPortalCancel ? (
            <button type="button" className="btn" disabled={portalLoading} onClick={openBillingPortal}>
              {portalLoading ? 'Opening...' : t('billing.cancelPlan')}
            </button>
          ) : null}
          {stripeCustomerId && stripeCapabilities?.resume && canResumeSubscription(subscriptionStatus) ? (
            <button type="button" className="btn" disabled={resumeLoading} onClick={resumeSubscription}>
              {resumeLoading ? 'Working...' : t('billing.resumePlan')}
            </button>
          ) : null}
          {!stripeCustomerId ? <p className="muted">{t('billing.noCustomer')}</p> : null}
          {stripeCustomerId && !stripeCapabilities?.portal && plan !== 'free' ? (
            <p className="billing-support-fallback">
              {t('billing.planChangesSupport')} <a href={supportMailtoHref('EverittOS billing')}>{SUPPORT_EMAIL}</a>
            </p>
          ) : null}
        </div>
        {message ? <p>{message}</p> : null}
      </div>

      <div className="settings-card">
        <h3>{t('billing.allPlans')}</h3>
        <p className="muted">{t('billing.pricingSubtitle')}</p>
        <BillingPlansGrid currentPlan={plan} highlightPlan={checkoutPlan !== 'free' ? checkoutPlan : undefined} />
      </div>

      <div className="settings-card">
        <UsageDashboard plan={plan} counts={usage} />
      </div>

      <div className="settings-card">
        <AiUsagePanel plan={plan} />
      </div>
    </SettingsShell>
  );
}

export default function BillingSettingsPage() {
  return (
    <Suspense>
      <BillingSettingsContent />
    </Suspense>
  );
}
