'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useTranslation } from '@/components/locale-provider';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isAdminRole, isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { filterDemoSeedJobs } from '@/lib/demo-seed-filter';
import { fetchOrganizationContext } from '@/lib/organization';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
import { fetchPhotoCountsByJobIds } from '@/lib/job-photo-counts';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { supabase } from '@/lib/supabase';

type Job = {
  id: string;
  title: string;
  customer_name: string | null;
  customer_id: string | null;
  address: string | null;
  status: string | null;
  completed_at?: string | null;
  assigned_to?: string | null;
  photo_count?: number;
};

function actionLabel(status: string | null): string {
  const value = String(status || 'new').toLowerCase();
  if (value === 'completed' || value === 'complete') return 'Get paid';
  if (value === 'in_progress' || value === 'in progress' || value === 'started') return 'Continue';
  if (value === 'cancelled' || value === 'canceled') return 'View';
  return 'Start';
}

function JobsList() {
  const router = useRouter();
  const { t } = useTranslation();
  const appFeedback = useAppFeedback();
  const searchParams = useSearchParams();
  const customerFilter = searchParams.get('customer');
  const statusFilter = searchParams.get('status');
  const periodFilter = searchParams.get('period');
  const assignmentFilter = searchParams.get('filter');
  const assignedToFilter = searchParams.get('assigned_to');
  const createdFromFilter = searchParams.get('from');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [removingId, setRemovingId] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError('');
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));

      const org = await fetchOrganizationContext(user.id);
      const workspaceRole = normalizeRole(org?.role || profile?.role);
      setRole(workspaceRole);

      const params = new URLSearchParams();
      if (customerFilter) params.set('customer', customerFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (periodFilter) params.set('period', periodFilter);
      if (assignmentFilter) params.set('filter', assignmentFilter);
      if (assignedToFilter) params.set('assigned_to', assignedToFilter);
      if (createdFromFilter) params.set('from', createdFromFilter);

      const res = await fetch(`/api/jobs?${params.toString()}`);
      const json = (await res.json()) as { jobs?: Job[]; error?: string };
      if (!res.ok) {
        const message = json.error || 'Unable to load jobs.';
        setLoadError(message);
        appFeedback.error(message);
        setJobs([]);
        setLoading(false);
        return;
      }

      const orgIsDemo = await fetchOrganizationIsDemo(supabase, org?.organizationId);
      const rows = filterDemoSeedJobs(json.jobs || [], orgIsDemo);
      const photoCounts = await fetchPhotoCountsByJobIds(rows.map((job) => job.id));
      setJobs(rows.map((job) => ({ ...job, photo_count: photoCounts[job.id] || 0 })));
      setLoading(false);
    }

    void load();
  }, [router, customerFilter, statusFilter, periodFilter, assignmentFilter, assignedToFilter, createdFromFilter, appFeedback]);

  async function removeJob(job: Job) {
    if (!window.confirm(`Remove job "${job.title}"?`)) return;
    setRemovingId(job.id);
    const res = await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' });
    setRemovingId('');
    if (!res.ok) {
      const json = await res.json();
      window.alert(json.error || 'Unable to remove job.');
      return;
    }
    setJobs((rows) => rows.filter((row) => row.id !== job.id));
  }

  const filtered = Boolean(assignedToFilter || statusFilter || createdFromFilter || assignmentFilter);

  return (
    <AppShell plan={plan} role={role}>
      <div className="jobs-list-page">
        <PageHeader
          title={t('nav.jobs')}
          action={
            <Link className="btn btn-primary" href="/jobs/new">
              New job
            </Link>
          }
        />

        <div className="button-row" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Link href="/jobs" className="btn">All</Link>
          <Link href="/jobs?period=today" className="btn">Today</Link>
          <Link href="/jobs?status=active" className="btn">Active</Link>
          <Link href="/jobs?status=completed" className="btn">Finished</Link>
          {isManagerRole(role) ? <Link href="/jobs?filter=unassigned" className="btn">Needs worker</Link> : null}
        </div>

        {filtered ? (
          <p className="muted" style={{ marginBottom: 12 }}>
            Filtered · <Link href="/jobs">Show all</Link>
          </p>
        ) : null}

        {isAdminRole(role) && assignmentFilter === 'missing_completion_date' ? (
          <p className="muted" style={{ marginBottom: 12 }}>
            Finished jobs missing a finish date.
          </p>
        ) : null}

        {loadError ? <p className="auth-message auth-message-error">{loadError}</p> : null}
        {loading ? <p className="loading-state" role="status">Loading...</p> : null}
        {!loading && jobs.length === 0 ? <LocalizedEmptyState emptyKey="jobs" /> : null}

        {!loading && jobs.length > 0 ? (
          <div style={{ display: 'grid', gap: 14 }}>
            {jobs.map((job) => (
              <article key={job.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ marginBottom: 6 }}>{job.title}</h3>
                    <p style={{ margin: 0 }}>{job.customer_name || 'No customer'}</p>
                    <p className="muted" style={{ marginTop: 4 }}>{job.address || 'No address'}</p>
                  </div>
                  <StatusPill status={job.status} />
                </div>

                {job.photo_count ? (
                  <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
                    {job.photo_count} photo{job.photo_count === 1 ? '' : 's'}
                  </p>
                ) : null}

                <div className="button-row" style={{ marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Link href={`/jobs/${job.id}`} className="btn btn-primary">
                    {actionLabel(job.status)}
                  </Link>
                  {job.address ? (
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`}
                      className="btn"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Maps
                    </a>
                  ) : null}
                  {isManagerRole(role) ? (
                    <details style={{ marginLeft: 'auto' }}>
                      <summary className="btn">More</summary>
                      <div style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={removingId === job.id}
                          onClick={() => void removeJob(job)}
                        >
                          {removingId === job.id ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    </details>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

export default function JobsPage() {
  return (
    <Suspense>
      <JobsList />
    </Suspense>
  );
}
