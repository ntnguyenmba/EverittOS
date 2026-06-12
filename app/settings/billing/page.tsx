'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccessBlockedBanner } from '@/components/access-blocked-banner';
import { AppShell } from '@/components/app-shell';
import { SettingsShell } from '@/components/settings/settings-shell';
import { AiUsagePanel } from '@/components/ai-usage-panel';
import { UsageDashboard } from '@/components/usage-dashboard';
import { mapAccessError } from '@/lib/auth-errors';
import {
  EVERITTOS_PLANS,
  EVERITTOS_STRIPE_LINKS,
  normalizePlan,
  planDisplayName,
  type EverittosPlan
} from '@/lib/everittos-plans';
import { fetchOrganizationContext } from '@/lib/organization';
import { canManageBilling, normalizeRole } from '@/lib/roles';
import { fetchUsageCounts } from '@/lib/everittos-usage';
import { canCancelSubscription, canResumeSubscription } from '@/lib/stripe-subscription';
import { subscriptionAccess } from '@/lib/subscription-access';
import { useTranslation } from '@/components/locale-provider';
import { subscriptionStatusMessage } from '@/lib/stripe-subscription';
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
  const [renewalDate, setRenewalDate] = useState<string | null>(null);
  const [stripeCustomerId, setStripeCustomerId] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

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
        .select('plan, role, subscription_status, stripe_customer_id')
        .eq('id', user.id)
        .maybeSingle();

      const resolvedPlan = normalizePlan(profile?.plan);
      setPlan(resolvedPlan);
      setRole(normalizeRole(profile?.role));
      setSubscriptionStatus(profile?.subscription_status || 'free');
      setStripeCustomerId(profile?.stripe_customer_id || '');

      const { data: subscription } = await supabase
        .from('everittos_subscriptions')
        .select('current_period_end, status')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscription?.current_period_end) {
        setRenewalDate(subscription.current_period_end);
      }
      if (subscription?.status && !profile?.subscription_status) {
        setSubscriptionStatus(subscription.status);
      }

      const org = await fetchOrganizationContext(user.id);
      const counts = await fetchUsageCounts(user.id, org?.organizationId);
      setUsage(counts);
      setLoading(false);
    }

    load();
  }, [router]);

  async function openBillingPortal() {
    setPortalLoading(true);
    setMessage('');
    const res = await fetch('/api/stripe/portal', { method: 'POST' });
    const json = await res.json();
    setPortalLoading(false);

    if (!res.ok) {
      setMessage(json.error || 'Unable to open billing portal.');
      return;
    }

    window.location.href = json.url;
  }

  async function cancelSubscription() {
    setCancelLoading(true);
    setMessage('');
    const res = await fetch('/api/stripe/cancel-subscription', { method: 'POST' });
    const json = await res.json();
    setCancelLoading(false);

    if (!res.ok) {
      setMessage(json.error || 'Unable to cancel subscription.');
      return;
    }

    setSubscriptionStatus('canceled');
    setMessage(json.message || 'Subscription updated.');
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

  const canBilling = canManageBilling(role);
  const subscriptionInfo = subscriptionAccess(plan, subscriptionStatus);

  return (
    <SettingsShell plan={plan} role={role} title={t('billing.title')} description="Subscription status, usage, and plan changes.">
      {accessNotice ? (
        <AccessBlockedBanner
          title={accessNotice.title}
          message={accessNotice.message}
          details={accessNotice.details}
        />
      ) : null}
      {searchParams.get('upgrade') ? (
        <div className="settings-warning" style={{ marginBottom: 18 }}>
          {planDisplayName(upgradePlan)} or higher is required for that page. Choose a plan below to upgrade.
        </div>
      ) : null}
      <div className="settings-card">
        <h3>Current subscription</h3>
        <div className="settings-row">
          <span className="settings-row-label">{t('billing.currentPlan')}</span>
          <span className="settings-row-value">{planDisplayName(plan)}</span>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t('billing.status')}</span>
          <span className="settings-row-value">{subscriptionStatus}</span>
        </div>
        {renewalDate ? (
          <div className="settings-row">
            <span className="settings-row-label">{t('billing.renewalDate')}</span>
            <span className="settings-row-value">
              {new Date(renewalDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        ) : null}
        <p className="muted">{subscriptionStatusMessage(subscriptionStatus)}</p>
        <p className="muted">{subscriptionInfo.message}</p>
        {!subscriptionInfo.ok && subscriptionInfo.billingRequired ? (
          <p className="muted">Update payment in Stripe to restore full access to paid features.</p>
        ) : null}

        {!canBilling ? <p className="muted">Contact your workspace owner to change billing.</p> : null}

        {canBilling ? (
          <div className="settings-actions">
            {stripeCustomerId ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={portalLoading}
                onClick={openBillingPortal}
                aria-label="Open Stripe customer portal in a new tab"
              >
                {portalLoading ? 'Opening…' : t('billing.manageStripe')}
              </button>
            ) : (
              <p className="muted">{t('billing.noCustomer')}</p>
            )}
            {canCancelSubscription(subscriptionStatus) ? (
              <button type="button" className="btn" disabled={cancelLoading} onClick={cancelSubscription}>
                {cancelLoading ? 'Working...' : t('billing.cancel')}
              </button>
            ) : null}
            {canResumeSubscription(subscriptionStatus) ? (
              <button type="button" className="btn btn-primary" disabled={resumeLoading} onClick={resumeSubscription}>
                {resumeLoading ? 'Working...' : t('billing.resume')}
              </button>
            ) : null}
          </div>
        ) : null}

        {message ? <p>{message}</p> : null}
      </div>

      <div className="settings-card">
        <UsageDashboard plan={plan} counts={usage} />
      </div>

      <div className="settings-card">
        <AiUsagePanel plan={plan} />
      </div>

      <div className="settings-card">
        <h3>{t('billing.upgradeOptions')}</h3>
        <div className="pricing-grid compact">
          {EVERITTOS_PLANS.filter((tier) => tier.id !== 'free').map((tier) => (
            <div key={tier.id} className="card" style={{ marginTop: 0 }}>
              <h4>{tier.name}</h4>
              <p>{tier.priceLabel}</p>
              <p className="muted">{tier.limits.join(' · ')}</p>
              {tier.stripeLink && canBilling ? (
                <a
                  className="btn btn-primary"
                  href={tier.stripeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${tier.buttonLabel} (opens Stripe in a new tab)`}
                >
                  {tier.buttonLabel}
                </a>
              ) : null}
            </div>
          ))}
        </div>
        <div className="settings-actions">
          {canBilling && plan === 'free' ? (
            <a className="btn btn-primary" href={EVERITTOS_STRIPE_LINKS.pro} target="_blank" rel="noopener noreferrer">
              Start Pro
            </a>
          ) : null}
        </div>
        <p className="muted" style={{ marginTop: 16 }}>
          Subscriptions renew automatically until canceled. Cancel anytime from billing or the Stripe customer portal.{' '}
          <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link>
        </p>
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
