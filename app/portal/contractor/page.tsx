'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { supabase } from '@/lib/supabase';
import { performClientLogout } from '@/lib/client-logout';

type WorkerRow = {
  id: string;
  name: string | null;
  email: string | null;
  auth_user_id: string | null;
};

type AssignmentRow = {
  job_id: string;
  worker_id: string;
};

type JobRow = {
  id: string;
  title: string | null;
  customer_name: string | null;
  address: string | null;
  status: string | null;
  start_date: string | null;
  due_date: string | null;
  scheduled_start: string | null;
  assigned_to: string | null;
};

type LaborRow = {
  id: string;
  job_id: string;
  worker_id: string;
  total_cost: number | string | null;
  payment_status: string | null;
};

type LoadState = 'loading' | 'ready' | 'error';

const LOAD_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: PromiseLike<T>, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(timeoutMessage)), LOAD_TIMEOUT_MS);
    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function jobDate(job: JobRow) {
  const value = job.scheduled_start || job.start_date || job.due_date;
  if (!value) return 'Date not set';
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? 'Date not set'
    : date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        ...(value.includes('T') ? { hour: 'numeric', minute: '2-digit' } : {})
      });
}

function normalizedStatus(value: string | null) {
  return String(value || 'scheduled').trim().toLowerCase().replace(/\s+/g, '_');
}

function isCompleted(value: string | null) {
  return ['completed', 'complete', 'done', 'finished', 'closed'].includes(normalizedStatus(value));
}

function isCancelled(value: string | null) {
  return ['cancelled', 'canceled'].includes(normalizedStatus(value));
}

export default function ContractorPortalPage() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [workerName, setWorkerName] = useState('Contractor');
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [labor, setLabor] = useState<LaborRow[]>([]);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    setError('');

    try {
      const auth = await withTimeout(supabase.auth.getUser(), 'Your session took too long to load.');
      const user = auth.data.user;
      if (auth.error || !user) {
        router.replace('/login?next=%2Fportal%2Fcontractor');
        return;
      }

      const email = String(user.email || '').trim().toLowerCase();
      const workerFields = 'id, name, email, auth_user_id';
      const [byUser, byEmail] = await Promise.all([
        withTimeout(
          supabase.from('workers').select(workerFields).eq('auth_user_id', user.id),
          'Your contractor profile took too long to load.'
        ),
        email
          ? withTimeout(
              supabase.from('workers').select(workerFields).ilike('email', email),
              'Your contractor profile took too long to load.'
            )
          : Promise.resolve({ data: [] as WorkerRow[], error: null })
      ]);

      if (byUser.error && byEmail.error) throw new Error(byUser.error.message || byEmail.error.message);

      const workerMap = new Map<string, WorkerRow>();
      for (const row of [...((byUser.data || []) as WorkerRow[]), ...((byEmail.data || []) as WorkerRow[])]) {
        workerMap.set(row.id, row);
      }
      const workers = Array.from(workerMap.values());
      const workerIds = workers.map((row) => row.id).filter(Boolean);
      setWorkerName(workers.find((row) => row.name?.trim())?.name?.trim() || email || 'Contractor');

      if (!workerIds.length) {
        setJobs([]);
        setLabor([]);
        setError('Your login is not linked to a contractor profile yet. Ask the company owner to link your email to your worker record.');
        setState('error');
        return;
      }

      const [assignmentsResult, directJobsResult, laborResult] = await Promise.all([
        withTimeout(
          supabase.from('job_assignments').select('job_id, worker_id').in('worker_id', workerIds),
          'Assigned jobs took too long to load.'
        ),
        withTimeout(
          supabase
            .from('jobs')
            .select('id, title, customer_name, address, status, start_date, due_date, scheduled_start, assigned_to')
            .in('assigned_to', workerIds),
          'Jobs took too long to load.'
        ),
        withTimeout(
          supabase
            .from('job_labor')
            .select('id, job_id, worker_id, total_cost, payment_status')
            .in('worker_id', workerIds),
          'Earnings took too long to load.'
        )
      ]);

      if (assignmentsResult.error) throw new Error(assignmentsResult.error.message);
      if (directJobsResult.error) throw new Error(directJobsResult.error.message);
      if (laborResult.error) throw new Error(laborResult.error.message);

      const assignmentJobIds = Array.from(
        new Set(((assignmentsResult.data || []) as AssignmentRow[]).map((row) => row.job_id).filter(Boolean))
      );

      let assignedJobs: JobRow[] = [];
      if (assignmentJobIds.length) {
        const assignedResult = await withTimeout(
          supabase
            .from('jobs')
            .select('id, title, customer_name, address, status, start_date, due_date, scheduled_start, assigned_to')
            .in('id', assignmentJobIds),
          'Assigned job details took too long to load.'
        );
        if (assignedResult.error) throw new Error(assignedResult.error.message);
        assignedJobs = (assignedResult.data || []) as JobRow[];
      }

      const merged = new Map<string, JobRow>();
      for (const job of [...((directJobsResult.data || []) as JobRow[]), ...assignedJobs]) merged.set(job.id, job);

      setJobs(Array.from(merged.values()));
      setLabor((laborResult.data || []) as LaborRow[]);
      setState('ready');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The contractor dashboard could not load.';
      setError(message);
      setState('error');
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const currentJobs = jobs.filter((job) => !isCompleted(job.status) && !isCancelled(job.status));
    const completedJobs = jobs.filter((job) => isCompleted(job.status));
    const total = labor.reduce((sum, row) => sum + Number(row.total_cost || 0), 0);
    const paid = labor
      .filter((row) => normalizedStatus(row.payment_status) === 'paid')
      .reduce((sum, row) => sum + Number(row.total_cost || 0), 0);
    return {
      assigned: jobs.length,
      upcoming: currentJobs.length,
      completed: completedJobs.length,
      total,
      paid,
      owed: Math.max(0, total - paid)
    };
  }, [jobs, labor]);

  const sortedJobs = useMemo(
    () => [...jobs].sort((a, b) => String(a.scheduled_start || a.start_date || '').localeCompare(String(b.scheduled_start || b.start_date || ''))),
    [jobs]
  );

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await performClientLogout();
      window.location.assign('/login');
    } catch {
      setSigningOut(false);
      router.replace('/login');
    }
  }

  return (
    <AuthenticatedSection role="contractor" className="contractor-dashboard role-dashboard-minimal">
      <header className="card" style={{ marginBottom: 18 }}>
        <p className="eyebrow" style={{ margin: '0 0 12px' }}>Contractor dashboard</p>
        <h1 style={{ marginBottom: 6 }}>Welcome back</h1>
        <p className="muted" style={{ margin: 0 }}>{workerName}</p>
        <nav className="button-row contractor-portal-actions" style={{ marginTop: 20, flexWrap: 'wrap' }}>
          <a className="btn btn-primary" href="#jobs">Jobs</a>
          <a className="btn" href="#schedule">Schedule</a>
          <a className="btn" href="#earnings">Earnings</a>
          <Link className="btn" href="/portal/contractor/settings">Settings</Link>
          <button type="button" className="btn" disabled={signingOut} onClick={() => void signOut()}>
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </nav>
      </header>

      {state === 'loading' ? (
        <section className="card" aria-live="polite">
          <h3 style={{ marginTop: 0 }}>Loading your contractor dashboard...</h3>
          <p className="muted">This should take only a few seconds.</p>
        </section>
      ) : null}

      {state === 'error' ? (
        <section className="card" role="alert">
          <h3 style={{ marginTop: 0 }}>The contractor dashboard could not load</h3>
          <p>{error}</p>
          <p className="muted">No jobs, payments, or earnings were changed.</p>
          <button type="button" className="btn btn-primary" onClick={() => void load()}>Try again</button>
        </section>
      ) : null}

      {state === 'ready' ? (
        <>
          <section className="metric-grid" style={{ marginBottom: 18 }}>
            <article className="card"><span className="muted">Assigned jobs</span><h2>{totals.assigned}</h2></article>
            <article className="card"><span className="muted">Upcoming jobs</span><h2>{totals.upcoming}</h2></article>
            <article className="card"><span className="muted">Completed jobs</span><h2>{totals.completed}</h2></article>
            <article className="card"><span className="muted">Total earnings</span><h2>{money(totals.total)}</h2></article>
            <article className="card"><span className="muted">Paid to you</span><h2>{money(totals.paid)}</h2></article>
            <article className="card"><span className="muted">Still owed</span><h2>{money(totals.owed)}</h2></article>
          </section>

          <section id="jobs" className="card" style={{ marginBottom: 18 }}>
            <h3 style={{ marginTop: 0 }}>Jobs</h3>
            {sortedJobs.length ? (
              <div className="job-visits-list">
                {sortedJobs.map((job) => (
                  <article key={job.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                    <div>
                      <strong>{job.title || 'Job'}</strong>
                      <p className="muted" style={{ margin: '5px 0 0' }}>{jobDate(job)}</p>
                      <p style={{ margin: '5px 0 0' }}>{job.customer_name || 'Customer'}{job.address ? ` · ${job.address}` : ''}</p>
                    </div>
                    <span>{normalizedStatus(job.status).replaceAll('_', ' ')}</span>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">No assigned jobs yet.</p>
            )}
          </section>

          <section id="schedule" className="card" style={{ marginBottom: 18 }}>
            <h3 style={{ marginTop: 0 }}>Schedule</h3>
            <p className="muted">Your upcoming assigned jobs appear above in date order.</p>
          </section>

          <section id="earnings" className="card">
            <h3 style={{ marginTop: 0 }}>Earnings</h3>
            <p><strong>{money(totals.paid)}</strong> paid · <strong>{money(totals.owed)}</strong> still owed</p>
            <p className="muted">Earnings are calculated only from contractor payment records linked to your worker profile.</p>
          </section>
        </>
      ) : null}
    </AuthenticatedSection>
  );
}
