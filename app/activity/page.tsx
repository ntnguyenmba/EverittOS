'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActivityFeed } from '@/components/activity-feed';
import { AppShell } from '@/components/app-shell';
import { EmptyState } from '@/components/empty-state';
import { ACTIVITY_EVENT_LABELS } from '@/lib/activity-server';
import { filterBusinessActivity } from '@/lib/business-activity';
import { EMPTY_COPY } from '@/lib/empty-copy';
import { fetchOrganizationContext } from '@/lib/organization';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type ActivityItem = {
  id: string;
  action: string;
  message: string | null;
  entity_type: string;
  created_at: string | null;
  actor_name: string | null;
  user_id: string | null;
};

export default function ActivityPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      const p = normalizePlan(profile?.plan);
      setPlan(p);
      setRole(normalizeRole(profile?.role));

      if (!limitsForPlan(p).activityLog) {
        setLoading(false);
        return;
      }

      const org = await fetchOrganizationContext(user.id);
      if (!org) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('activity_logs')
        .select('id, action, message, entity_type, created_at, actor_name, user_id')
        .eq('organization_id', org.organizationId)
        .order('created_at', { ascending: false })
        .limit(250);

      setItems(filterBusinessActivity(data || []));
      setLoading(false);
    }

    load();
  }, [router]);

  const actionOptions = useMemo(() => {
    const set = new Set(items.map((i) => i.action));
    return Array.from(set).sort();
  }, [items]);

  const userOptions = useMemo(() => {
    const set = new Set(items.map((i) => i.actor_name || i.user_id || '').filter(Boolean));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (actionFilter && item.action !== actionFilter) return false;
      if (userFilter && (item.actor_name || item.user_id) !== userFilter) return false;
      if (dateFrom && item.created_at && item.created_at.slice(0, 10) < dateFrom) return false;
      if (dateTo && item.created_at && item.created_at.slice(0, 10) > dateTo) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const haystack = `${item.message || ''} ${item.action} ${item.actor_name || ''} ${item.entity_type}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [items, actionFilter, userFilter, dateFrom, dateTo, search]);

  const enabled = limitsForPlan(plan).activityLog;

  return (
    <AppShell plan={plan} role={role}>
      <h1>Activity log</h1>
      <p className="muted">
        Business operations history for your workspace. Sign-in and security events are in{' '}
        <Link href="/settings/security">Settings → Security</Link>.
      </p>
      {!enabled && (
        <div className="card" style={{ marginTop: 18 }}>
          Activity log requires Business, Operations, Growth, or Enterprise.
        </div>
      )}
      {enabled && (
        <>
          <div className="card activity-filters" style={{ marginTop: 18 }}>
            <div className="filter-grid">
              <label className="auth-field">
                <span>Search</span>
                <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Message, action, user…" />
              </label>
              <label className="auth-field">
                <span>Event type</span>
                <select className="input" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
                  <option value="">All events</option>
                  {actionOptions.map((action) => (
                    <option key={action} value={action}>
                      {ACTIVITY_EVENT_LABELS[action] || action}
                    </option>
                  ))}
                </select>
              </label>
              <label className="auth-field">
                <span>User</span>
                <select className="input" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
                  <option value="">All users</option>
                  {userOptions.map((user) => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
                </select>
              </label>
              <label className="auth-field">
                <span>From</span>
                <input className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </label>
              <label className="auth-field">
                <span>To</span>
                <input className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </label>
            </div>
            <p className="muted">{filtered.length} event{filtered.length === 1 ? '' : 's'} shown</p>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            {loading ? (
              <p className="loading-state" role="status">
                Loading activity…
              </p>
            ) : filtered.length === 0 ? (
              <EmptyState title={EMPTY_COPY.activity.title} description={EMPTY_COPY.activity.description} />
            ) : (
              <ActivityFeed items={filtered} loading={loading} />
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
