'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthenticatedSection } from '@/components/authenticated-section';

type Diagnostics = {
  currentUser: { id: string; email: string; role: string | null };
  workspace: {
    id: string;
    name: string;
    ownerUserId: string;
    organizationPlanColumn: string | null;
  } | null;
  effectivePlan: string;
  ownerProfile: {
    id: string;
    email: string | null;
    plan: string;
    subscriptionStatus: string | null;
    stripeCustomerId: string | null;
  } | null;
  viewerProfile: {
    plan: string;
    subscriptionStatus: string;
    stripeCustomerId: string | null;
  };
  subscriptionRow: {
    plan: string;
    status: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripePriceId: string | null;
    updatedAt: string;
  } | null;
  lastWebhook: { eventType: string; stripeEventId: string; receivedAt: string } | null;
  lastWebhookSync: {
    eventType: string;
    success: boolean;
    reason: string | null;
    writes: unknown;
    syncedAt: string;
  } | null;
  lastManualSync: { eventType: string; plan: string | null; payload: unknown; syncedAt: string } | null;
  webhookEndpoint: string;
};

export default function BillingDiagnosticsPage() {
  const router = useRouter();
  const [data, setData] = useState<Diagnostics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/admin/billing-diagnostics', { cache: 'no-store' });
      const json = await res.json();
      setLoading(false);
      if (res.status === 401) {
        router.push('/login?next=/admin/billing-diagnostics');
        return;
      }
      if (!res.ok) {
        setError(json.error || 'Unable to load billing diagnostics.');
        return;
      }
      setData(json as Diagnostics);
    }
    void load();
  }, [router]);

  return (
    <AuthenticatedSection>
      <h1>Billing diagnostics</h1>
      {loading ? <p className="muted">Loading billing diagnostics…</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {data ? (
        <div className="stack gap-4">
          <p className="muted">Debug-only view for Stripe activation failures. Requires ADMIN_EMAILS.</p>
          <section className="card">
            <h2>Current user</h2>
            <pre>{JSON.stringify(data.currentUser, null, 2)}</pre>
          </section>
          <section className="card">
            <h2>Workspace</h2>
            <pre>{JSON.stringify(data.workspace, null, 2)}</pre>
          </section>
          <section className="card">
            <h2>Plans</h2>
            <pre>
              {JSON.stringify(
                {
                  effectivePlan: data.effectivePlan,
                  ownerProfile: data.ownerProfile,
                  viewerProfile: data.viewerProfile,
                  subscriptionRow: data.subscriptionRow
                },
                null,
                2
              )}
            </pre>
          </section>
          <section className="card">
            <h2>Webhook + sync history</h2>
            <p className="muted">Expected endpoint: {data.webhookEndpoint}</p>
            <pre>
              {JSON.stringify(
                {
                  lastWebhook: data.lastWebhook,
                  lastWebhookSync: data.lastWebhookSync,
                  lastManualSync: data.lastManualSync
                },
                null,
                2
              )}
            </pre>
          </section>
        </div>
      ) : null}
    </AuthenticatedSection>
  );
}
