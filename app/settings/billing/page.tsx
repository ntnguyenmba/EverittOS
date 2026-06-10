'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SettingsShell } from '@/components/settings/settings-shell';
import { UsageDashboard } from '@/components/usage-dashboard';
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
import {
  canCancelSubscription,
  canResumeSubscription,
  subscriptionStatusMessage
} from '@/lib/stripe-subscription';
import { supabase } from '@/lib/supabase';

function BillingSettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const upgradePlan = normalizePlan(searchParams.get('upgrade'));
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
      <div className="dashboard-shell">
        <main className="main">
          <p>Loading billing...</p>
        </main>
      </div>
    );
  }

  const canBilling = canManageBilling(role);

  return (
    <SettingsShell plan={plan} title="Billing" description="Subscription status, usage, and plan changes.">
      {searchParams.get('upgrade') ? (
        <div className="settings-warning" style={{ marginBottom: 18 }}>
          {planDisplayName(upgradePlan)} or higher is required for that page. Choose a plan below to upgrade.
        </div>
      ) : null}
      <div className="settings-card">
        <h3>Current subscription</h3>
        <div className="settings-row">
          <span className="settings-row-label">Plan</span>
          <span className="settings-row-value">{planDisplayName(plan)}</span>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Status</span>
          <span className="settings-row-value">{subscriptionStatus}</span>
        </div>
        <p className="muted">{subscriptionStatusMessage(subscriptionStatus)}</p>

        {!canBilling ? <p className="muted">Contact your company owner to change billing.</p> : null}

        {canBilling ? (
          <div className="settings-actions">
            {stripeCustomerId ? (
              <button type="button" className="btn btn-primary" disabled={portalLoading} onClick={openBillingPortal}>
                {portalLoading ? 'Opening...' : 'Stripe customer portal'}
              </button>
            ) : (
              <p className="muted">No Stripe customer on file yet. Choose a paid plan below to start checkout.</p>
            )}
            {canCancelSubscription(subscriptionStatus) ? (
              <button type="button" className="btn" disabled={cancelLoading} onClick={cancelSubscription}>
                {cancelLoading ? 'Working...' : 'Cancel subscription'}
              </button>
            ) : null}
            {canResumeSubscription(subscriptionStatus) ? (
              <button type="button" className="btn btn-primary" disabled={resumeLoading} onClick={resumeSubscription}>
                {resumeLoading ? 'Working...' : 'Resume subscription'}
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
        <h3>Upgrade options</h3>
        <div className="pricing-grid compact">
          {EVERITTOS_PLANS.filter((tier) => tier.id !== 'free').map((tier) => (
            <div key={tier.id} className="card" style={{ marginTop: 0 }}>
              <h4>{tier.name}</h4>
              <p>{tier.priceLabel}</p>
              <p className="muted">{tier.limits.join(' · ')}</p>
              {tier.stripeLink && canBilling ? (
                <a className="btn btn-primary" href={tier.stripeLink} target="_blank" rel="noopener noreferrer">
                  {tier.buttonLabel}
                </a>
              ) : null}
            </div>
          ))}
        </div>
        <div className="settings-actions">
          <Link href="/pricing" className="btn">
            Full pricing page
          </Link>
          {canBilling && plan === 'free' ? (
            <a className="btn btn-primary" href={EVERITTOS_STRIPE_LINKS.pro} target="_blank" rel="noopener noreferrer">
              Start Pro
            </a>
          ) : null}
        </div>
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
