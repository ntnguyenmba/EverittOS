'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScheduleViews, type ScheduleJob } from '@/components/schedule-views';
import { Sidebar } from '@/components/sidebar';
import { fetchOrganizationContext } from '@/lib/organization';
import { canAssignJobs, normalizeRole } from '@/lib/roles';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { logClientActivity, createNotification } from '@/lib/activity';
import { supabase } from '@/lib/supabase';

export default function SchedulePage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [jobs, setJobs] = useState<ScheduleJob[]>([]);
  const [workerNames, setWorkerNames] = useState<Record<string, string>>({});
  const [canAssign, setCanAssign] = useState(false);
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
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

    const org = await fetchOrganizationContext(user.id);
    setOrgId(org?.organizationId || '');
    setCanAssign(limitsForPlan(p).crewAssignment && canAssignJobs(normalizeRole(profile?.role)));

    const { data, error: fetchError } = await supabase
      .from('jobs')
      .select('id, title, customer_name, status, start_date, due_date, assigned_to')
      .not('status', 'eq', 'cancelled')
      .order('due_date', { ascending: true, nullsFirst: false });

    setLoading(false);
    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    setJobs((data || []) as ScheduleJob[]);

    const { data: workers } = await supabase.from('workers').select('id, name');
    const map: Record<string, string> = {};
    (workers || []).forEach((w) => {
      map[w.id] = w.name;
    });
    setWorkerNames(map);
  }

  useEffect(() => {
    load();
  }, []);

  async function assignWorker(jobId: string, workerId: string | null) {
    const { error } = await supabase.from('jobs').update({ assigned_to: workerId }).eq('id', jobId);
    if (error) {
      setError(error.message);
      return;
    }
    if (orgId) {
      await logClientActivity(orgId, 'job', jobId, 'schedule_changed', workerId ? 'Worker assigned on schedule' : 'Worker unassigned');
      if (workerId) {
        const {
          data: { user }
        } = await supabase.auth.getUser();
        if (user) {
          await createNotification(orgId, user.id, 'assignment', 'Job assignment updated', 'A job assignment was updated from the schedule.', jobId);
        }
      }
    }
    load();
  }

  return (
    <div className="dashboard-shell">
      <Sidebar plan={plan} />
      <main className="main">
        <h2>Schedule</h2>
        <p>Calendar, daily, weekly, and upcoming job views.</p>

        {loading && <div className="card">Loading schedule...</div>}
        {error && <div className="card">{error}</div>}
        {!loading && !error && (
          <div className="card" style={{ marginTop: 18 }}>
            <ScheduleViews jobs={jobs} workerNames={workerNames} canAssign={canAssign} onAssign={assignWorker} />
          </div>
        )}
      </main>
    </div>
  );
}
