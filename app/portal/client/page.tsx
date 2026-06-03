'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PhotoGallery } from '@/components/photo-gallery';
import { normalizePlan } from '@/lib/everittos-plans';
import { limitsForPlan } from '@/lib/everittos-limits';
import { isClientRole, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type ClientJob = {
  id: string;
  title: string;
  status: string | null;
  customer_notes: string | null;
  due_date: string | null;
};

export default function ClientPortalPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ClientJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [reports, setReports] = useState<{ id: string; title: string; job_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/portal/client');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('role, plan').eq('id', user.id).maybeSingle();
      const role = normalizeRole(profile?.role);
      const plan = normalizePlan(profile?.plan);

      if (!isClientRole(role) && !limitsForPlan(plan).clientPortal) {
        setMessage('Client portal requires Operations plan or a client role.');
        setLoading(false);
        return;
      }

      const { data: access } = await supabase.from('job_client_access').select('job_id').eq('client_user_id', user.id);

      const jobIds = (access || []).map((a) => a.job_id);
      if (jobIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: jobRows } = await supabase
        .from('jobs')
        .select('id, title, status, customer_notes, due_date')
        .in('id', jobIds)
        .order('created_at', { ascending: false });

      setJobs((jobRows || []) as ClientJob[]);

      if (jobIds.length) {
        const { data: reportRows } = await supabase.from('job_reports').select('id, title, job_id').in('job_id', jobIds);
        setReports(reportRows || []);
      }

      setLoading(false);
    }
    load();
  }, [router]);

  return (
    <main className="section">
      <div className="container">
        <h2>Client portal</h2>
        <p className="muted">Your jobs, shared photos, and reports. Internal notes and team data are not shown.</p>

        {loading && <div className="card">Loading...</div>}
        {message && <div className="card">{message}</div>}
        {!loading && !message && jobs.length === 0 && <div className="card">No jobs shared with your account yet.</div>}

        {jobs.map((job) => (
          <div key={job.id} className="card" style={{ marginTop: 16 }}>
            <h3>{job.title}</h3>
            <p>Status: {job.status || 'new'}</p>
            <p>Due: {job.due_date || 'Not set'}</p>
            {job.customer_notes && <p>{job.customer_notes}</p>}
            <button type="button" className="btn" onClick={() => setSelectedJob(selectedJob === job.id ? null : job.id)}>
              {selectedJob === job.id ? 'Hide photos' : 'View photos'}
            </button>
            {selectedJob === job.id && <PhotoGallery jobId={job.id} refreshKey={0} />}
            {reports
              .filter((r) => r.job_id === job.id)
              .map((r) => (
                <Link key={r.id} className="btn btn-primary" href={`/jobs/${job.id}/report`} style={{ marginTop: 8 }}>
                  View report: {r.title}
                </Link>
              ))}
          </div>
        ))}

        <Link href="/dashboard" className="btn" style={{ marginTop: 24 }}>
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
