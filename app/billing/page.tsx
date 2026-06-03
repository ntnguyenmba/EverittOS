'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { UsageDashboard } from '@/components/usage-dashboard';
import { EVERITTOS_PLANS, EVERITTOS_STRIPE_LINKS, normalizePlan, planDisplayName, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchOrganizationContext } from '@/lib/organization';
import { canManageBilling, normalizeRole } from '@/lib/roles';
import { fetchUsageCounts } from '@/lib/everittos-usage';
import { supabase } from '@/lib/supabase';

export default function BillingPage() {
  const router = useRouter();
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
  const [subscriptionStatus, setSubscriptionStatus] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('plan, role, subscription_status').eq('id', user.id).maybeSingle();
      const p = normalizePlan(profile?.plan);
      setPlan(p);
      setRole(normalizeRole(profile?.role));
      setSubscriptionStatus(profile?.subscription_status || 'free');

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

  if (loading) {
    return (
      <div className="dashboard-shell">
        <Sidebar plan={plan} />
        <main className="main">
          <div className="card">Loading billing...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <Sidebar plan={plan} />
      <main className="main">
        <h2>Billing</h2>
        <p className="muted">Subscription, usage, and upgrade options for your company.</p>

        <div className="card" style={{ marginTop: 18 }}>
          <h3>Current subscription</h3>
          <p>
            <strong>Plan:</strong> {planDisplayName(plan)}
          </p>
          <p>
            <strong>Status:</strong> {subscriptionStatus}
          </p>
          {!canManageBilling(role) && <p className="muted">Contact your company owner to change billing.</p>}
          {canManageBilling(role) && (
            <button type="button" className="btn btn-primary" disabled={portalLoading} onClick={openBillingPortal}>
              {portalLoading ? 'Opening...' : 'Manage billing in Stripe'}
            </button>
          )}
          {message && <p>{message}</p>}
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <UsageDashboard plan={plan} counts={usage} />
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <h3>Compare plans</h3>
          <div className="pricing-grid compact">
            {EVERITTOS_PLANS.filter((t) => t.id !== 'free').map((tier) => (
              <div key={tier.id} className="card" style={{ marginTop: 12 }}>
                <h4>{tier.name}</h4>
                <p>{tier.priceLabel}</p>
                <p className="muted">{tier.limits.join(' · ')}</p>
                {tier.stripeLink && canManageBilling(role) && (
                  <a className="btn btn-primary" href={tier.stripeLink} target="_blank" rel="noopener noreferrer">
                    {tier.buttonLabel}
                  </a>
                )}
              </div>
            ))}
          </div>
          <Link href="/pricing" className="btn" style={{ marginTop: 16 }}>
            Full pricing page
          </Link>
        </div>
      </main>
    </div>
  );
}
