'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { StatusPill } from '@/components/status-pill';
import { supabase } from '@/lib/supabase';

type PageProps = {
  params: {
    id: string;
  };
};

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

export default function JobDetailPage({ params }: PageProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function loadJob() {
    setLoading(true);
    const { data, error } = await supabase.from('jobs').select('*').eq('id', params.id).single();
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setJob(data);
  }

  async function updateStatus(status: string) {
    const { error } = await supabase.from('jobs').update({ status }).eq('id', params.id);

    if (error) {
      alert(error.message);
      return;
    }

    loadJob();
  }

  useEffect(() => {
    loadJob();
  }, []);

  if (loading) {
    return <div className="dashboard-shell"><Sidebar /><main className="main"><div className="card">Loading job...</div></main></div>;
  }

  if (!job) {
    return <div className="dashboard-shell"><Sidebar /><main className="main"><div className="card">{message || 'Job not found.'}</div></main></div>;
  }

  return (
    <div className="dashboard-shell">
      <Sidebar />
      <main className="main">
        <div className="page-head">
          <div>
            <h2>{job.title}</h2>
            <p>{job.address || 'No address added'}</p>
          </div>
          <StatusPill status={job.status} />
        </div>

        <div className="grid-2">
          <div className="card">
            <h3>Job details</h3>
            <p><strong>Customer:</strong> {job.customer_name || 'No customer'}</p>
            <p><strong>Phone:</strong> {job.phone || 'No phone'}</p>
            <p><strong>Address:</strong> {job.address || 'No address'}</p>
            <p><strong>Notes:</strong> {job.notes || 'No notes'}</p>
            <p><strong>Created:</strong> {job.created_at ? new Date(job.created_at).toLocaleString() : 'Just created'}</p>

            <div className="form" style={{ marginTop: 16 }}>
              <button className="btn" type="button" onClick={() => updateStatus('in_progress')}>Start job</button>
              <button className="btn btn-primary" type="button" onClick={() => updateStatus('completed')}>Mark completed</button>
            </div>
          </div>

          <div className="card">
            <h3>Proof report</h3>
            <p>Photo upload and printable proof report are next.</p>
            <button className="btn" type="button" onClick={() => window.print()}>Print report</button>
          </div>
        </div>
      </main>
    </div>
  );
}
