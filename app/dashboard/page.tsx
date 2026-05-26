'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { DashboardStats } from '@/components/dashboard-stats';
import { JobCard } from '@/components/job-card';
import { JobCreator } from '@/components/job-creator';
import { supabase } from '@/lib/supabase';

type SupabaseJob = {
  id: string;
  title: string;
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: string | null;
  created_at: string | null;
};

export default function DashboardPage() {
  const [jobs, setJobs] = useState<SupabaseJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadJobs() {
    setLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('jobs')
      .select('id,title,customer_name,phone,address,notes,status,created_at')
      .order('created_at', { ascending: false });

    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      console.error('Supabase load jobs error:', error);
      return;
    }

    setJobs(data || []);
  }

  useEffect(() => {
    loadJobs();
  }, []);

  return (
    <div className="dashboard-shell">
      <Sidebar />
      <main className="main">
        <div className="page-head">
          <div>
            <h2>Manager Dashboard</h2>
            <p>Assign jobs, track crews, and verify work from one place.</p>
          </div>
        </div>

        <DashboardStats />

        <div className="grid-2" style={{ marginTop: 18 }}>
          <JobCreator onJobCreated={loadJobs} />

          <div className="workflow">
            {loading && <div className="card">Loading jobs...</div>}

            {errorMessage && (
              <div className="card" style={{ color: 'var(--red)' }}>
                {errorMessage}
              </div>
            )}

            {!loading && !errorMessage && jobs.length === 0 && (
              <div className="card">No jobs yet. Create your first job.</div>
            )}

            {!loading && !errorMessage && jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
