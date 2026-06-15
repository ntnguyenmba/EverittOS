'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccessBlockedBanner } from '@/components/access-blocked-banner';
import { AppShell } from '@/components/app-shell';
import { SettingsShell } from '@/components/settings/settings-shell';
import { AiUsagePanel } from '@/components/ai-usage-panel';
import { StaffAiUsagePanel } from '@/components/staff-ai-usage-panel';
import { UsageDashboard } from '@/components/usage-dashboard';
import { mapAccessError } from '@/lib/auth-errors';
import { BillingPlansGrid } from '@/components/billing-plans-grid';
import { SUPPORT_EMAIL, supportMailtoHref } from '@/lib/support';
import { formatCouponDuration } from '@/lib/stripe-promo';
import { normalizePlan, planDisplayName, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizeRole } from '@/lib/roles';
import { fetchUsageCounts } from '@/lib/everittos-usage';
import { canResumeSubscription, subscriptionStatusMessage } from '@/lib/stripe-subscription';
import { SyncSubscriptionButton } from '@/components/sync-subscription-button';
import { BillingHealthCheck } from '@/components/billing-health-check';
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
      const billingMessage = status
        ? subscriptionAccess(upgradePlan, status).message
        : mapped.message;
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
    rawProfilePlan,
    rawSubscriptionStatus,
    loading: planLoading,
    refresh: refreshWorkspacePlan
  } = useWorkspacePlan();

  const [plan, setPlan] = useState<EverittosPlan | null>(null);
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
    if (resolvedBillingPlan) {
      setPlan(resolvedBillingPlan);
    }
    if (workspaceRole) {
      setRole(workspaceRole);
    }
    if (workspaceSubscriptionStatus) {
      setSubscriptionStatus(workspaceSubscriptionStatus);
    }
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
        if (!cancelled) {
          setCheckoutBanner({ tone: 'warning', message: t('billing.promo.checkoutSyncing') });
        }
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
  const subscriptionInfo = subscriptionAccess(plan, subscriptionStatus || 'free');

  return (
    <SettingsShell plan={plan} role={role} title={t('billing.title')} description={t('billing.description')}>
      {accessNotice && !canManageWorkspaceBilling ? (
        <AccessBlockedBanner title={accessNotice.title} message={accessNotice.message} details={accessNotice.details} />
      ) : accessNotice && canManageWorkspaceBilling ? (
        <AccessBlockedBanner
          title={accessNotice.title}
          message={subscriptionInfo.message}
          details={accessNotice.details}
        />
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
      {checkoutSyncing ? <p className="muted">Syncing your subscription with Stripe…</p> : null}
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
        <div className="settings-row">
          <span className="settings-row-label">{t('billing.status')}</span>
          <span className="settings-row-value">{subscriptionStatus || rawSubscriptionStatus || '—'}</span>
        </div>
        {rawProfilePlan && rawProfilePlan !== plan ? (
          <div className="settings-row">
            <span className="settings-row-label">Database plan</span>
            <span className="settings-row-value">{rawProfilePlan}</span>
          </div>
        ) : null}
        {renewalDate ? (
          <div className="settings-row">
            <span className="settings-row-label">{t('billing.renewalDate')}</span>
            <span className="settings-row-value">
              {new Date(renewalDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        ) : null}
        <p className="muted">{subscriptionStatusMessage(subscriptionStatus || undefined)}</p>
        <p className="muted">{subscriptionInfo.message}</p>
        {!subscriptionInfo.ok && subscriptionInfo.billingRequired ? (
          <p className="muted">Update payment in Stripe to restore full access to paid features.</p>
        ) : null}

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

      {canManageWorkspaceBilling ? (
        <div className="settings-card">
          <BillingHealthCheck />
        </div>
      ) : null}

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

      <div className="settings-card">
        <StaffAiUsagePanel />
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
