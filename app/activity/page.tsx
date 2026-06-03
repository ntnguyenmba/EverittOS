'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActivityFeed } from '@/components/activity-feed';
import { Sidebar } from '@/components/sidebar';
import { fetchOrganizationContext } from '@/lib/organization';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { supabase } from '@/lib/supabase';

export default function ActivityPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
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

      const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
      const p = normalizePlan(profile?.plan);
      setPlan(p);

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
    <div className="dashboard-shell">
      <Sidebar plan={plan} />
      <main className="main">
        <h2>Activity log</h2>
        {!enabled && <div className="card">Activity log requires Business, Operations, Growth, or Enterprise.</div>}
        {enabled && (
          <div className="card" style={{ marginTop: 18 }}>
            <ActivityFeed items={items} loading={loading} />
          </div>
        )}
      </main>
    </div>
  );
}
