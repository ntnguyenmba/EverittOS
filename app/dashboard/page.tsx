'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { DashboardStats } from '@/components/dashboard-stats';
import { JobCreator } from '@/components/job-creator';
import { supabase } from '@/lib/supabase';

type Job = {
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
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadJobs() {
    setLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });

    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
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
            <div className="card">
              <h3>Live Jobs</h3>

              {loading && <p>Loading jobs...</p>}
              {errorMessage && <p>{errorMessage}</p>}
              {!loading && !errorMessage && jobs.length === 0 && <p>No jobs yet. Create your first job.</p>}

              {!loading && !errorMessage && jobs.map((job) => (
                <div key={job.id} className="card" style={{ marginTop: 12 }}>
                  <h3>{job.title}</h3>
                  <p>Customer: {job.customer_name || 'No customer'}</p>
                  <p>Phone: {job.phone || 'No phone'}</p>
                  <p>Address: {job.address || 'No address'}</p>
                  <p>Notes: {job.notes || 'No notes'}</p>
                  <p>Status: {job.status || 'new'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
