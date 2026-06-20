'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccessBlockedBanner } from '@/components/access-blocked-banner';
import { AppShell } from '@/components/app-shell';
import { SettingsShell } from '@/components/settings/settings-shell';
import { mapAccessError } from '@/lib/auth-errors';
import { BillingPlansGrid } from '@/components/billing-plans-grid';
import { SUPPORT_EMAIL, supportMailtoHref } from '@/lib/support';
import { formatCouponDuration } from '@/lib/stripe-promo';
import { normalizePlan, planDisplayName, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole } from '@/lib/roles';
import { canResumeSubscription, subscriptionStatusMessage } from '@/lib/stripe-subscription';
import { BillingHealthCheck } from '@/components/billing-health-check';
import { SyncSubscriptionButton } from '@/components/sync-subscription-button';
import { canManageBilling } from '@/lib/roles';
import { subscriptionAccess } from '@/lib/subscription-access';
import { isPaidPlanActive } from '@/lib/workspace-subscription';
import { useTranslation } from '@/components/locale-provider';
import { useWorkspacePlan } from '@/hooks/use-workspace-plan';
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
      const billingMessage = status ? subscriptionAccess(upgradePlan, status).message : mapped.message;
      return {
        ...mapped,
        message: billingMessage,
        details: detail || status || mapped.details
      };
    }
    return null;
  }, [searchParams, upgradePlan]);

  const {
    profilePlan,
    subscriptionStatus: workspaceSubscriptionStatus,
    billingPlan,
    organizationPlan,
    plan: workspacePlan,
    role: workspaceRole,
    loading: planLoading,
    refresh: refreshWorkspacePlan
  } = useWorkspacePlan();

  const [plan, setPlan] = useState<EverittosPlan | null>(null);
  const [role, setRole] = useState(normalizeRole('owner'));
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [renewalDate, setRenewalDate] = useState<string | null>(null);
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
  const [checkoutBanner, setCheckoutBanner] = useState<{
    tone: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);
  const [checkoutSyncing, setCheckoutSyncing] = useState(false);

  const checkoutPlan = normalizePlan(searchParams.get('upgrade') || searchParams.get('plan'));

  useEffect(() => {
    if (planLoading) return;

    const resolvedBillingPlan = billingPlan ?? profilePlan ?? workspacePlan;
    if (resolvedBillingPlan) setPlan(resolvedBillingPlan);
    if (workspaceRole) setRole(workspaceRole);
    if (workspaceSubscriptionStatus) setSubscriptionStatus(workspaceSubscriptionStatus);
  }, [
    planLoading,
    profilePlan,
    billingPlan,
    organizationPlan,
    workspacePlan,
    workspaceRole,
    workspaceSubscriptionStatus
  ]);

  useEffect(() => {
    const checkout = searchParams.get('checkout');
    const sessionId = searchParams.get('session_id');

    if (checkout === 'cancelled') {
      setCheckoutBanner({ tone: 'error', message: t('billing.promo.checkoutCancelled') });
      return;
    }

    if (checkout !== 'success') return;

    let cancelled = false;

    async function syncAfterCheckout() {
      setCheckoutSyncing(true);
      setCheckoutBanner(null);

      try {
        const res = await fetch('/api/billing/refresh-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionId || undefined })
        });
        const json = (await res.json().catch(() => ({}))) as {
          plan?: string;
          status?: string;
          active?: boolean;
          synced?: boolean;
        };

        if (cancelled) return;

        await refreshWorkspacePlan();

        const refreshedPlan = json.plan ? normalizePlan(json.plan) : null;
        const refreshedStatus = json.status || workspaceSubscriptionStatus || 'free';
        const activated =
          refreshedPlan &&
          refreshedPlan !== 'free' &&
          (json.active ?? isPaidPlanActive(refreshedPlan, refreshedStatus));

        if (activated) {
          setPlan(refreshedPlan);
          setSubscriptionStatus(refreshedStatus);
          setCheckoutBanner({ tone: 'success', message: t('billing.promo.checkoutActivated') });
          return;
        }

        for (let attempt = 0; attempt < 3; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
          const retry = await fetch('/api/billing/refresh-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: sessionId || undefined })
          });
          const retryJson = (await retry.json().catch(() => ({}))) as { plan?: string; status?: string; active?: boolean };
          await refreshWorkspacePlan();

          const retryPlan = retryJson.plan ? normalizePlan(retryJson.plan) : null;
          const retryStatus = retryJson.status || 'free';
          if (
            retryPlan &&
            retryPlan !== 'free' &&
            (retryJson.active ?? isPaidPlanActive(retryPlan, retryStatus))
          ) {
            setPlan(retryPlan);
            setSubscriptionStatus(retryStatus);
            setCheckoutBanner({ tone: 'success', message: t('billing.promo.checkoutActivated') });
            return;
          }
        }

        setCheckoutBanner({ tone: 'warning', message: t('billing.promo.checkoutSyncing') });
      } catch {
        if (!cancelled) setCheckoutBanner({ tone: 'warning', message: t('billing.promo.checkoutSyncing') });
      } finally {
        if (!cancelled) setCheckoutSyncing(false);
      }
    }

    void syncAfterCheckout();

    return () => {
      cancelled = true;
    };
  }, [searchParams, refreshWorkspacePlan, t, workspaceSubscriptionStatus]);

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
          'role, stripe_customer_id, stripe_promotion_code, coupon_name, coupon_percent_off, coupon_amount_off, coupon_duration, coupon_duration_in_months, coupon_expires_at'
        )
        .eq('id', user.id)
        .maybeSingle();

      setRole(normalizeRole(profile?.role || workspaceRole || 'owner'));
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
        .select('current_period_end')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscription?.current_period_end) setRenewalDate(subscription.current_period_end);

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
  }, [router, workspaceRole]);

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
    await refreshWorkspacePlan();
  }

  if (loading || planLoading || !plan) {
    return (
      <AppShell role={role}>
        <p>{checkoutSyncing ? 'Activating your plan…' : 'Loading billing...'}</p>
      </AppShell>
    );
  }

  const canManageWorkspaceBilling = canManageBilling(role);
  const canOpenPortal = Boolean(stripeCustomerId && stripeCapabilities?.portal);
  const showPortalCancel = canOpenPortal && plan !== 'free' && subscriptionStatus !== 'canceled';
  const hasActiveSubscription = plan !== 'free' && Boolean(stripeCustomerId) && subscriptionStatus !== 'canceled';
  const subscriptionInfo = subscriptionAccess(plan, subscriptionStatus || 'free');
  const planStatus = subscriptionStatus || 'free';
  const renewalLabel = renewalDate
    ? new Date(renewalDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Not scheduled';

  return (
    <SettingsShell plan={plan} role={role} title="Plans & billing" description="Manage your EverittOS plan, payment, and renewal settings.">
      <div style={{ display: 'grid', gap: 18 }}>
        {accessNotice && !canManageWorkspaceBilling ? (
          <AccessBlockedBanner title={accessNotice.title} message={accessNotice.message} details={accessNotice.details} />
        ) : accessNotice && canManageWorkspaceBilling ? (
          <AccessBlockedBanner title={accessNotice.title} message={subscriptionInfo.message} details={accessNotice.details} />
        ) : null}

        {checkoutBanner ? (
          <p
            className={[
              'auth-message',
              checkoutBanner.tone === 'success'
                ? 'auth-message-success'
                : checkoutBanner.tone === 'warning'
                  ? 'auth-message-warning'
                  : 'auth-message-error'
            ].join(' ')}
          >
            {checkoutBanner.message}
          </p>
        ) : null}

        {checkoutSyncing ? <p className="muted">Activating your plan...</p> : null}

        {searchParams.get('upgrade') ? (
          <div className="settings-warning">
            {planDisplayName(upgradePlan)} or higher is required for that page. Choose a plan below to upgrade.
          </div>
        ) : null}

        <section
          className="settings-card"
          style={{
            display: 'grid',
            gap: 20,
            padding: 24,
            borderRadius: 20,
            background: 'linear-gradient(135deg, #ffffff 0%, #f7f8f6 100%)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: '0 0 6px', color: 'var(--muted)', fontSize: 13 }}>Current plan</p>
              <h3 style={{ margin: 0, fontSize: 28, lineHeight: 1.15 }}>{planDisplayName(plan)}</h3>
            </div>
            <div
              style={{
                alignSelf: 'flex-start',
                border: '1px solid rgba(47, 95, 143, 0.18)',
                borderRadius: 999,
                padding: '6px 12px',
                color: 'var(--accent)',
                background: 'rgba(47, 95, 143, 0.07)',
                fontSize: 13,
                fontWeight: 600,
                textTransform: 'capitalize'
              }}
            >
              {planStatus.replaceAll('_', ' ')}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 16, background: '#fff' }}>
              <p style={{ margin: '0 0 4px', color: 'var(--muted)', fontSize: 13 }}>Subscription</p>
              <strong style={{ color: 'var(--text)', textTransform: 'capitalize' }}>{planStatus.replaceAll('_', ' ')}</strong>
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 16, background: '#fff' }}>
              <p style={{ margin: '0 0 4px', color: 'var(--muted)', fontSize: 13 }}>Renewal</p>
              <strong style={{ color: 'var(--text)' }}>{renewalLabel}</strong>
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 16, background: '#fff' }}>
              <p style={{ margin: '0 0 4px', color: 'var(--muted)', fontSize: 13 }}>Plan access</p>
              <strong style={{ color: 'var(--text)' }}>{subscriptionInfo.ok ? 'Active' : 'Action needed'}</strong>
            </div>
          </div>

          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14, lineHeight: 1.55 }}>
            {subscriptionStatusMessage(subscriptionStatus || undefined)} {subscriptionInfo.message}
          </p>

          <div className="settings-actions" style={{ marginTop: 0 }}>
            {canOpenPortal ? (
              <button type="button" className="btn btn-primary" disabled={portalLoading} onClick={openBillingPortal}>
                {portalLoading ? 'Opening...' : 'Manage subscription'}
              </button>
            ) : null}
            {showPortalCancel ? (
              <button type="button" className="btn" disabled={portalLoading} onClick={openBillingPortal}>
                {portalLoading ? 'Opening...' : 'Cancel plan'}
              </button>
            ) : null}
            {stripeCustomerId && stripeCapabilities?.resume && canResumeSubscription(subscriptionStatus) ? (
              <button type="button" className="btn" disabled={resumeLoading} onClick={resumeSubscription}>
                {resumeLoading ? 'Working...' : 'Resume plan'}
              </button>
            ) : null}
            {!canOpenPortal && plan !== 'free' ? (
              <p className="billing-support-fallback">
                Need help with billing? <a href={supportMailtoHref('EverittOS billing')}>{SUPPORT_EMAIL}</a>
              </p>
            ) : null}
            {canManageWorkspaceBilling ? (
              <SyncSubscriptionButton
                onSynced={(nextPlan, nextStatus) => {
                  setPlan(normalizePlan(nextPlan));
                  setSubscriptionStatus(nextStatus);
                  void refreshWorkspacePlan();
                }}
              />
            ) : null}
          </div>
          {message ? <p className="auth-message auth-message-warning">{message}</p> : null}
        </section>

        {couponName ? (
          <section className="settings-card" style={{ display: 'grid', gap: 12 }}>
            <h3>Active discount</h3>
            <div className="settings-row">
              <span className="settings-row-label">Discount</span>
              <span className="settings-row-value">{couponName}</span>
            </div>
            {couponCode ? (
              <div className="settings-row">
                <span className="settings-row-label">Code</span>
                <span className="settings-row-value">{couponCode}</span>
              </div>
            ) : null}
            <div className="settings-row">
              <span className="settings-row-label">Savings</span>
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
                <span className="settings-row-label">Expires</span>
                <span className="settings-row-value">
                  {new Date(couponExpiresAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="settings-card settings-card-billing-plans" style={{ padding: 24, borderRadius: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <h3 style={{ marginBottom: 6 }}>Choose your plan</h3>
              <p className="muted" style={{ margin: 0 }}>
                Upgrade, switch, or review available plans.
              </p>
            </div>
          </div>
          <BillingPlansGrid
            currentPlan={plan}
            highlightPlan={checkoutPlan !== 'free' ? checkoutPlan : undefined}
            hasActiveSubscription={hasActiveSubscription}
            portalAvailable={canOpenPortal}
            onOpenPortal={canOpenPortal ? openBillingPortal : undefined}
            portalLoading={portalLoading}
          />
        </section>

        {canManageWorkspaceBilling ? (
          <section className="settings-card">
            <BillingHealthCheck />
          </section>
        ) : null}

        <section className="settings-card" style={{ display: 'grid', gap: 8 }}>
          <h3>Billing terms</h3>
          <p className="muted" style={{ margin: 0 }}>
            Payments are final and non-refundable. Canceling stops future renewals only. Prior charges are not refunded.
          </p>
          <p className="muted" style={{ margin: 0 }}>
            Promo codes are applied during checkout when available.
          </p>
        </section>
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
