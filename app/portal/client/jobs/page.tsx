'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { CLIENT_SETTINGS_PATH } from '@/lib/client-portal';
import { clientPortalJobsPath, CLIENT_PORTAL_HOME } from '@/lib/portal-access';
import { isClientRole, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type ClientJob = {
  id: string;
  title: string;
  status: string | null;
  due_date: string | null;
};

export default function ClientPortalJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ClientJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push(`/login?next=${encodeURIComponent(clientPortalJobsPath())}`);
        return;
      }

      const { data: profileRow } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (!isClientRole(normalizeRole(profileRow?.role))) {
        router.replace(CLIENT_PORTAL_HOME);
        return;
      }

      const { data: access } = await supabase.from('job_client_access').select('job_id').eq('client_user_id', user.id);
      const jobIds = ((access || []) as Array<{ job_id: string }>).map((row) => String(row.job_id)).filter(Boolean);

      if (jobIds.length === 1) {
        router.replace(clientPortalJobsPath(jobIds[0]));
        return;
      }

      if (jobIds.length === 0) {
        setJobs([]);
        setMessage('There are currently no shared jobs for your account. When a business shares a job with you, it will appear here.');
        setLoading(false);
        return;
      }

      const { data: jobRows } = await supabase
        .from('jobs')
        .select('id, title, status, due_date')
        .in('id', jobIds)
        .order('created_at', { ascending: false });

      setJobs((jobRows || []) as ClientJob[]);
      setLoading(false);
    }

    void load();
  }, [router]);

  if (loading) {
    return (
      <AuthenticatedSection role="client">
        <div className="card" role="status" aria-live="polite">
          Loading your shared jobs...
        </div>
      </AuthenticatedSection>
    );
  }

  return (
    <AuthenticatedSection role="client">
      <header style={{ marginBottom: 20 }}>
        <p className="eyebrow">Client portal</p>
        <h2>Shared jobs</h2>
        <p className="muted">Only jobs shared with you are listed here.</p>
      </header>

      <nav className="inline-actions" style={{ marginBottom: 16, flexWrap: 'wrap' }} aria-label="Portal sections">
        <Link href={CLIENT_PORTAL_HOME} className="btn">
          Overview
        </Link>
        <Link href={clientPortalJobsPath()} className="btn btn-primary" aria-current="page">
          Appointments
        </Link>
        <Link href={CLIENT_SETTINGS_PATH} className="btn">
          Account
        </Link>
      </nav>

      {message ? (
        <div className="card" role="status">
          <h3>No shared jobs yet</h3>
          <p>{message}</p>
        </div>
      ) : (
        jobs.map((job) => (
          <article key={job.id} className="card" style={{ marginTop: 16 }}>
            <div className="list-row">
              <div>
                <strong>{job.title}</strong>
                <p className="muted">
                  {job.status || 'scheduled'}
                  {job.due_date ? ` · ${job.due_date}` : ''}
                </p>
              </div>
              <Link className="btn btn-primary" href={clientPortalJobsPath(job.id)}>
                Open job
              </Link>
            </div>
          </article>
        ))
      )}
    </AuthenticatedSection>
  );
}
