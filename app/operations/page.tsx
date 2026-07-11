'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchOperationsInbox, type OperationsInboxItem, type OperationsPriority } from '@/lib/operations-inbox';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { ensureOrganizationForUser } from '@/lib/workspace-client';

const priorityLabels: Record<OperationsPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium'
};

function priorityStyle(priority: OperationsPriority): React.CSSProperties {
  if (priority === 'urgent') return { borderColor: 'var(--danger, #a33)', background: 'var(--surface)' };
  if (priority === 'high') return { borderColor: 'var(--warning, #9a6b22)', background: 'var(--surface)' };
  return { borderColor: 'var(--line)', background: 'var(--surface)' };
}

export default function OperationsPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [items, setItems] = useState<OperationsInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | OperationsPriority>('all');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const [{ data: profile }, org] = await Promise.all([
      supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle(),
      ensureOrganizationForUser(user.id)
    ]);

    const resolvedPlan = normalizePlan(profile?.plan);
    const resolvedRole = normalizeRole(org?.role || profile?.role);
    setPlan(resolvedPlan);
    setRole(resolvedRole);

    if (!org?.organizationId) {
      setItems([]);
      setError('No organization workspace was found for this account.');
      setLoading(false);
      return;
    }

    try {
      const nextItems = await fetchOperationsInbox(supabase, org.organizationId);
      setItems(nextItems);
    } catch (loadError) {
      console.error(loadError);
      setError('EverittOS could not load the operations inbox.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const visibleItems = useMemo(
    () => (filter === 'all' ? items : items.filter((item) => item.priority === filter)),
    [filter, items]
  );

  const counts = useMemo(
    () => ({
      all: items.length,
      urgent: items.filter((item) => item.priority === 'urgent').length,
      high: items.filter((item) => item.priority === 'high').length,
      medium: items.filter((item) => item.priority === 'medium').length
    }),
    [items]
  );

  return (
    <AppShell plan={plan} role={role}>
      <div className="today-page">
        <PageHeader
          title="Operations Inbox"
          subtitle="The work EverittOS believes needs attention next, based on live job and payment data."
        />

        <section className="card" style={{ marginBottom: 18 }}>
          <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
            {(['all', 'urgent', 'high', 'medium'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={filter === value ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
                onClick={() => setFilter(value)}
              >
                {value === 'all' ? 'All' : priorityLabels[value]} ({counts[value]})
              </button>
            ))}
            <button type="button" className="btn btn-sm" onClick={() => void load()} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </section>

        {error ? <section className="card"><p style={{ margin: 0 }}>{error}</p></section> : null}

        {!loading && !error && visibleItems.length === 0 ? (
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Nothing needs attention</h2>
            <p className="muted" style={{ marginBottom: 0 }}>
              No matching overdue jobs, unassigned upcoming jobs, overdue invoices, or missing completion reports were found.
            </p>
          </section>
        ) : null}

        <div style={{ display: 'grid', gap: 14 }}>
          {visibleItems.map((item) => (
            <article
              key={item.id}
              className="card"
              style={{ ...priorityStyle(item.priority), borderWidth: 1, borderStyle: 'solid' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ maxWidth: 760 }}>
                  <p className="stat-label" style={{ marginTop: 0 }}>{priorityLabels[item.priority]}</p>
                  <h2 style={{ margin: '8px 0 10px' }}>{item.title}</h2>
                  <p style={{ margin: 0 }}>{item.detail}</p>
                  <p className="muted" style={{ margin: '12px 0 0' }}>
                    Recommended next action: {item.recommendedAction}
                  </p>
                </div>
                <Link className="btn btn-primary btn-sm" href={item.href}>
                  Review item
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
