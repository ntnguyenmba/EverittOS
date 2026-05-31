'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { DashboardStats } from '@/components/dashboard-stats';
import { JobCreator } from '@/components/job-creator';
import { EVERITTOS_STRIPE_LINKS, isPaidEverittosPlan, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { supabase } from '@/lib/supabase';

type Job = {
  id: string;
  title: string;
  customer_name: string | null;
  status: string | null;
  created_at: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [photoCount, setPhotoCount] = useState(0);
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
    setPlan(normalizePlan(profile?.plan));

    const [jobsRes, photosRes] = await Promise.all([
      supabase.from('jobs').select('id, title, customer_name, status, created_at').order('created_at', { ascending: false }),
      supabase.from('job_photos').select('id', { count: 'exact', head: true })
    ]);

    setLoading(false);

    if (jobsRes.error) {
      setErrorMessage(jobsRes.error.message);
      return;
    }

    setJobs(jobsRes.data || []);
    setPhotoCount(photosRes.count || 0);
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const stats = useMemo(() => {
    const openJobs = jobs.filter((j) => j.status !== 'completed' && j.status !== 'cancelled').length;
    const completedJobs = jobs.filter((j) => j.status === 'completed').length;
    return { openJobs, completedJobs };
  }, [jobs]);

  return (
    <div className="dashboard-shell">
      <Sidebar plan={plan} />

      <main className="main">
        <div className="page-head">
          <div>
            <h2>Dashboard</h2>
            <p>Active work, crew activity, and plan usage at a glance.</p>
          </div>
        </div>

        {!isPaidEverittosPlan(plan) && (
          <div className="card upgrade-banner">
            <div>
              <h3>Upgrade when you need more control</h3>
              <p>Pro adds photo storage and crew assignment. Business adds multiple crews and locations.</p>
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

        <DashboardStats openJobs={stats.openJobs} completedJobs={stats.completedJobs} photoCount={photoCount} />

        <div className="grid-2" style={{ marginTop: 18 }}>
          <JobCreator onJobCreated={loadDashboard} />

          <div className="workflow">
            <div className="card">
              <h3>Recent jobs</h3>
              {loading && <p>Loading jobs...</p>}
              {errorMessage && <p>{errorMessage}</p>}
              {!loading && !errorMessage && jobs.length === 0 && <p>No jobs yet. Create your first job.</p>}

              {!loading &&
                !errorMessage &&
                jobs.slice(0, 6).map((job) => (
                  <div key={job.id} className="card" style={{ marginTop: 12 }}>
                    <h3>{job.title}</h3>
                    <p>Customer: {job.customer_name || 'No customer'}</p>
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
