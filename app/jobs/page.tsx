'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AppShell } from '@/components/app-shell';
import { useTranslation } from '@/components/locale-provider';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { filterDemoSeedJobs } from '@/lib/demo-seed-filter';
import { fetchOrganizationContext } from '@/lib/organization';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
import { fetchPhotoCountsByJobIds } from '@/lib/job-photo-counts';
import { RecordActions } from '@/components/record-actions';
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
      const photoCounts = await fetchPhotoCountsByJobIds(rows.map((j) => j.id));
      setJobs(rows.map((j) => ({ ...j, photo_count: photoCounts[j.id] || 0 })));
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

  return (
    <AppShell plan={plan} role={role}>
        <PageHeader
          title={t('nav.jobs')}
          action={
            <Link className="btn btn-primary" href="/jobs/new">
              {t('empty.jobs.action')}
            </Link>
          }
        />
        {assignedToFilter || statusFilter || createdFromFilter ? (
          <p className="muted" style={{ marginBottom: 12 }}>
            Filtered view. <Link href="/jobs">Show all jobs</Link>
          </p>
        ) : null}
        {isManagerRole(role) ? (
          <p className="muted" style={{ marginBottom: 12 }}>
            {assignmentFilter === 'unassigned' ? (
              <>
                Showing jobs that need assignment.{' '}
                <Link href="/jobs">Show all jobs</Link>
              </>
            ) : (
              <>
                <Link href="/jobs?filter=unassigned">Needs assignment</Link>
              </>
            )}
          </p>
        ) : null}

        <div className="card table-responsive-wrap">
          {loadError ? <p className="auth-message auth-message-error">{loadError}</p> : null}
          {loading ? <p className="loading-state" role="status">{t('common.loading')}</p> : null}
          {!loading && jobs.length === 0 ? <LocalizedEmptyState emptyKey="jobs" /> : null}
          {!loading && jobs.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Customer</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      {job.title}
                      {job.photo_count ? (
                        <span className="muted" style={{ marginLeft: 8 }}>
                          {job.photo_count} photo{job.photo_count === 1 ? '' : 's'}
                        </span>
                      ) : null}
                    </td>
                    <td>{job.customer_name || 'Not set'}</td>
                    <td>{job.address || 'Not set'}</td>
                    <td>
                      <StatusPill status={job.status} />
                    </td>
                    <td className="table-actions">
                      <RecordActions
                        viewHref={`/jobs/${job.id}`}
                        editHref={`/jobs/${job.id}`}
                        onRemove={() => void removeJob(job)}
                        removing={removingId === job.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
