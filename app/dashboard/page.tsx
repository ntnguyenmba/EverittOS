'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { UsageStats } from '@/components/usage-stats';
import { JobCreator } from '@/components/job-creator';
import { EVERITTOS_STRIPE_LINKS, isPaidEverittosPlan, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchUsageCounts, type UsageCounts } from '@/lib/everittos-usage';
import { supabase } from '@/lib/supabase';

type Job = {
  id: string;
  title: string;
  customer_name: string | null;
  status: string | null;
  due_date: string | null;
  created_at: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [usage, setUsage] = useState<UsageCounts>({ jobs: 0, photos: 0, customers: 0, reports: 0, workers: 0 });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadDashboard() {
    setLoading(true);
    setErrorMessage('');

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
    const { data: biz } = await supabase.from('business_profiles').select('onboarding_completed').eq('user_id', user.id).maybeSingle();

    if (biz && biz.onboarding_completed === false) {
      router.push('/onboarding');
      return;
    }

    setPlan(normalizePlan(profile?.plan));

    const [jobsRes, counts] = await Promise.all([
      supabase
        .from('jobs')
        .select('id, title, customer_name, status, due_date, created_at')
        .order('created_at', { ascending: false }),
      fetchUsageCounts(user.id)
    ]);

    setLoading(false);

    if (jobsRes.error) {
      setErrorMessage(jobsRes.error.message);
      return;
    }

    setJobs(jobsRes.data || []);
    setUsage(counts);
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const upcoming = useMemo(() => {
    return jobs
      .filter((j) => j.due_date && j.status !== 'completed' && j.status !== 'cancelled')
      .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
      .slice(0, 5);
  }, [jobs]);

  return (
    <div className="dashboard-shell">
      <Sidebar plan={plan} />

      <main className="main">
        <div className="page-head">
          <div>
            <h2>Dashboard</h2>
            <p>Plan usage, upcoming work, and recent jobs.</p>
          </div>
        </div>

        {!isPaidEverittosPlan(plan) && (
          <div className="card upgrade-banner">
            <div>
              <h3>Upgrade when you need more capacity</h3>
              <p>Pro adds unlimited jobs, photos, and customers. Business adds crew assignment and team access.</p>
            </div>
            <div className="upgrade-banner-actions">
              <a href={EVERITTOS_STRIPE_LINKS.pro} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                Start Pro
              </a>
              <a href={EVERITTOS_STRIPE_LINKS.business} target="_blank" rel="noopener noreferrer" className="btn">
                Start Business
              </a>
            </div>
          </div>
        )}

        <UsageStats plan={plan} counts={usage} />

        <div className="grid-2" style={{ marginTop: 18 }}>
          <JobCreator onJobCreated={loadDashboard} />

          <div className="workflow">
            <div className="card">
              <h3>Upcoming jobs</h3>
              {loading && <p>Loading...</p>}
              {!loading && upcoming.length === 0 && <p>No upcoming due dates. Set due dates on job details.</p>}
              {!loading &&
                upcoming.map((job) => (
                  <div key={job.id} className="card" style={{ marginTop: 12 }}>
                    <h3>{job.title}</h3>
                    <p>Due: {job.due_date}</p>
                    <Link className="btn" href={`/jobs/${job.id}`}>
                      Open
                    </Link>
                  </div>
                ))}
              <Link className="btn" href="/schedule" style={{ marginTop: 12 }}>
                View schedule
              </Link>
            </div>

            <div className="card" style={{ marginTop: 18 }}>
              <h3>Recent jobs</h3>
              {loading && <p>Loading jobs...</p>}
              {errorMessage && <p>{errorMessage}</p>}
              {!loading && !errorMessage && jobs.length === 0 && <p>No jobs yet. Create your first job.</p>}
              {!loading &&
                !errorMessage &&
                jobs.slice(0, 5).map((job) => (
                  <div key={job.id} className="card" style={{ marginTop: 12 }}>
                    <h3>{job.title}</h3>
                    <p>Customer: {job.customer_name || 'Not set'}</p>
                    <p>Status: {job.status || 'new'}</p>
                    <Link className="btn btn-primary" href={`/jobs/${job.id}`}>
                      Open job
                    </Link>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
