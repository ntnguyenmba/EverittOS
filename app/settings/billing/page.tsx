'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccessBlockedBanner } from '@/components/access-blocked-banner';
import { AppShell } from '@/components/app-shell';
import { SettingsShell } from '@/components/settings/settings-shell';
import { mapAccessError } from '@/lib/auth-errors';
import { BillingPlansGrid } from '@/components/billing-plans-grid';
import { formatCouponDuration } from '@/lib/stripe-promo';
import { normalizePlan, planDisplayName, type EverittosPlan } from '@/lib/everittos-plans';
import { canManageBilling, normalizeRole } from '@/lib/roles';
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
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [stripeCapabilities, setStripeCapabilities] = useState<{ portal: boolean } | null>(null);
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
  const checkoutSyncStartedRef = useRef<string | null>(null);

  const checkoutPlan = normalizePlan(searchParams.get('upgrade') || searchParams.get('plan'));

  useEffect(() => {
    if (planLoading) return;

    const resolvedBillingPlan = workspacePlan ?? organizationPlan ?? profilePlan ?? billingPlan;
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
    const sessionId = (searchParams.get('session_id') || '').trim();

    if (checkout === 'cancelled') {
      setCheckoutBanner({ tone: 'error', message: t('billing.promo.checkoutCancelled') });
      return;
    }

    if (checkout !== 'success') {
      return;
    }

    const syncKey = sessionId || 'checkout-success';
    if (checkoutSyncStartedRef.current === syncKey) return;
    checkoutSyncStartedRef.current = syncKey;

    let cancelled = false;

    async function syncAfterCheckout() {
      setCheckoutSyncing(true);
      setCheckoutBanner(null);

      const maxAttempts = 3;
      let checkoutUrlCleared = false;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        if (cancelled) return;

        try {
          const res = await fetch('/api/billing/refresh-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ sessionId: sessionId || undefined })
          });
          const json = (await res.json().catch(() => ({}))) as {
            plan?: string;
            status?: string;
            active?: boolean;
            synced?: boolean;
          };

          if (!checkoutUrlCleared) {
            checkoutUrlCleared = true;
            router.replace('/settings/billing?checkout=pending', { scroll: false });
          }

          if (!res.ok || !json.synced) {
            const fallback = await fetch('/api/stripe/sync-current-user', {
              method: 'POST',
              credentials: 'same-origin'
            });
            const fallbackJson = (await fallback.json().catch(() => ({}))) as {
              updated?: boolean;
              plan?: string;
              status?: string;
            };
            if (fallback.ok && fallbackJson.updated) {
              json.synced = true;
              json.plan = fallbackJson.plan;
              json.status = fallbackJson.status;
              json.active = true;
            }
          }

          await refreshWorkspacePlan({ silent: true });

          const latest = await fetch('/api/workspace/plan', { cache: 'no-store' })
            .then((r) => r.json())
            .catch(() => ({}));
          const effectivePlan = latest.organizationPlan
            ? normalizePlan(latest.organizationPlan)
            : latest.profilePlan
              ? normalizePlan(latest.profilePlan)
              : json.plan
                ? normalizePlan(json.plan)
                : null;
          const refreshedStatus = latest.subscriptionStatus || json.status || workspaceSubscriptionStatus || 'free';
          const activated =
            effectivePlan &&
            effectivePlan !== 'free' &&
            (json.active ?? isPaidPlanActive(effectivePlan, refreshedStatus));

          if (activated && effectivePlan) {
            setPlan(effectivePlan);
            setSubscriptionStatus(refreshedStatus);
            setCheckoutBanner({ tone: 'success', message: t('billing.promo.checkoutActivated') });
            router.replace('/settings/billing', { scroll: false });
            return;
          }

          if (attempt < maxAttempts) {
            await new Promise((resolve) => window.setTimeout(resolve, 1500));
          }
        } catch {
          if (attempt < maxAttempts) {
            await new Promise((resolve) => window.setTimeout(resolve, 1500));
          }
        }
      }

      if (!checkoutUrlCleared) {
        router.replace('/settings/billing', { scroll: false });
      }
    }

    void syncAfterCheckout().finally(() => {
      if (!cancelled) setCheckoutSyncing(false);
    });

    return () => {
      cancelled = true;
    };
  }, [searchParams, refreshWorkspacePlan, router, t, workspaceSubscriptionStatus]);

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
        setStripeCapabilities({ portal: Boolean(caps.portal) });
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

  if (loading || planLoading || !plan) {
    return (
      <AppShell role={role}>
        <p>{checkoutSyncing ? 'Activating your plan...' : 'Loading billing...'}</p>
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
    <SettingsShell plan={plan} role={role} title="Plans & billing" description="Manage your EverittOS plan and payment settings.">
      <div style={{ display: 'grid', gap: 18 }}>
        {accessNotice && !canManageWorkspaceBilling ? (
          <AccessBlockedBanner title={accessNotice.title} message={accessNotice.message} details={accessNotice.details} />
        ) : accessNotice && canManageWorkspaceBilling ? (
          <AccessBlockedBanner title={accessNotice.title} message={subscriptionInfo.message} details={accessNotice.details} />
        ) : null}

        {checkoutBanner && checkoutBanner.tone !== 'warning' ? (
          <p
            className={[
              'auth-message',
              checkoutBanner.tone === 'success' ? 'auth-message-success' : 'auth-message-error'
            ].join(' ')}
          >
            {checkoutBanner.message}
          </p>
        ) : null}

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

          <div className="settings-actions" style={{ marginTop: 0 }}>
            {canOpenPortal ? (
              <button type="button" className="btn btn-primary" disabled={portalLoading} onClick={openBillingPortal}>
                {portalLoading ? 'Opening...' : 'Manage billing'}
              </button>
            ) : null}
            {showPortalCancel ? (
              <button type="button" className="btn" disabled={portalLoading} onClick={openBillingPortal}>
                {portalLoading ? 'Opening...' : 'Cancel plan'}
              </button>
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
