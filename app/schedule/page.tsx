'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { supabase } from '@/lib/supabase';

type ScheduledJob = {
  id: string;
  title: string;
  customer_name: string | null;
  status: string | null;
  start_date: string | null;
  due_date: string | null;
  assigned_to: string | null;
};

export default function SchedulePage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [workerNames, setWorkerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));

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

      const upcoming = (data || []).filter(
        (j) => j.due_date || j.start_date || j.status !== 'completed'
      ) as ScheduledJob[];

      setJobs(upcoming);

      const { data: workers } = await supabase.from('workers').select('id, name');
      const map: Record<string, string> = {};
      (workers || []).forEach((w) => {
        map[w.id] = w.name;
      });
      setWorkerNames(map);
    }

    load();
  }, [router]);

  return (
    <div className="dashboard-shell">
      <Sidebar plan={plan} />
      <main className="main">
        <h2>Schedule</h2>
        <p>Upcoming jobs by start date and due date.</p>

        <div className="card" style={{ marginTop: 18 }}>
          {loading && <p>Loading schedule...</p>}
          {error && <p>{error}</p>}
          {!loading && !error && jobs.length === 0 && <p>No scheduled jobs yet. Add dates on a job detail page.</p>}
          {!loading &&
            !error &&
            jobs.map((job) => (
              <div key={job.id} className="card" style={{ marginTop: 12 }}>
                <h3>{job.title}</h3>
                <p>Customer: {job.customer_name || 'Not set'}</p>
                <p>Start: {job.start_date || 'Not set'}</p>
                <p>Due: {job.due_date || 'Not set'}</p>
                <p>Assigned: {(job.assigned_to && workerNames[job.assigned_to]) || 'Unassigned'}</p>
                <p>Status: {job.status || 'new'}</p>
                <Link className="btn btn-primary" href={`/jobs/${job.id}`}>
                  Open job
                </Link>
              </div>
            ))}
        </div>
      </main>
    </div>
  );
}
