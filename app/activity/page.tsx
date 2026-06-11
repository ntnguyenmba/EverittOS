'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActivityFeed } from '@/components/activity-feed';
import { AppShell } from '@/components/app-shell';
import { EmptyState } from '@/components/empty-state';
import { EMPTY_COPY } from '@/lib/empty-copy';
import { fetchOrganizationContext } from '@/lib/organization';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

export default function ActivityPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [items, setItems] = useState<
    { id: string; action: string; message: string | null; entity_type: string; created_at: string | null; actor_name: string | null }[]
  >([]);
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
        .select('id, action, message, entity_type, created_at, actor_name')
        .eq('organization_id', org.organizationId)
        .order('created_at', { ascending: false })
        .limit(100);

      setItems(data || []);
      setLoading(false);
    }

    load();
  }, [router]);

  const enabled = limitsForPlan(plan).activityLog;

  return (
    <AppShell plan={plan} role={role}>
      <h1>Activity log</h1>
      <p className="muted">Organization-wide audit trail of jobs, team, and billing events.</p>
      {!enabled && (
        <div className="card" style={{ marginTop: 18 }}>
          Activity log requires Business, Operations, Growth, or Enterprise.
        </div>
      )}
      {enabled && (
        <div className="card" style={{ marginTop: 18 }}>
          {loading ? (
            <p className="loading-state" role="status">
              Loading activity…
            </p>
          ) : items.length === 0 ? (
            <EmptyState title={EMPTY_COPY.activity.title} description={EMPTY_COPY.activity.description} />
          ) : (
            <ActivityFeed items={items} loading={loading} />
          )}
        </div>
      )}
    </AppShell>
  );
}
