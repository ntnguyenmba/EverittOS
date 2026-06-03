'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PhotoGallery } from '@/components/photo-gallery';
import { Sidebar } from '@/components/sidebar';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { supabase } from '@/lib/supabase';

type PageProps = {
  params: Promise<{ id: string }>;
};

type Job = {
  id: string;
  title: string;
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string | null;
};

export default function JobReportPage({ params }: PageProps) {
  const [jobId, setJobId] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [businessName, setBusinessName] = useState('EverittOS');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    params.then((p) => setJobId(p.id));
  }, [params]);

  useEffect(() => {
    if (!jobId) return;

    async function load() {
      setLoading(true);
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('plan, business_name').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));
      setBusinessName(profile?.business_name || 'Everitt Ventures');

      const { data, error } = await supabase.from('jobs').select('*').eq('id', jobId).single();
      setLoading(false);
      if (error) {
        setMessage(error.message);
        return;
      }
      setJob(data);
    }

    load();
  }, [jobId]);

  if (loading) {
    return (
      <div className="dashboard-shell">
        <Sidebar plan={plan} />
        <main className="main">
          <p>Loading report...</p>
        </main>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="dashboard-shell">
        <Sidebar plan={plan} />
        <main className="main">
          <p>{message || 'Job not found.'}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-shell report-shell">
      <Sidebar plan={plan} />
      <main className="main">
        <div className="page-head no-print">
          <div>
            <h2>Job proof report</h2>
            <p>Print or save as PDF from your browser.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" type="button" onClick={() => window.print()}>
              Print report
            </button>
            <Link className="btn" href={`/jobs/${job.id}`}>
              Back to job
            </Link>
          </div>
        </div>

        <article className="card report-document">
          <header className="report-header">
            <p className="report-brand">{businessName}</p>
            <h1>{job.title}</h1>
            <p className="report-meta">Status: {job.status || 'new'}</p>
          </header>

          <section>
            <h3>Job details</h3>
            <p>Customer: {job.customer_name || 'Not set'}</p>
            <p>Phone: {job.phone || 'Not set'}</p>
            <p>Address: {job.address || 'Not set'}</p>
            <p>Notes: {job.notes || 'None'}</p>
            <p>Start date: {job.start_date || 'Not set'}</p>
            <p>Due date: {job.due_date || 'Not set'}</p>
            <p>Completed: {job.completed_at ? new Date(job.completed_at).toLocaleString() : 'Not completed'}</p>
          </section>

          <section>
            <h3>Photos</h3>
            <PhotoGallery jobId={job.id} />
          </section>

          <footer className="report-footer">
            <p>Generated {new Date().toLocaleString()}</p>
          </footer>
        </article>
      </main>
    </div>
  );
}
