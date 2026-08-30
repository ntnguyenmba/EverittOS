'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useTranslation } from '@/components/locale-provider';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { formatMoneyUsd } from '@/lib/i18n/locale-format';
import { displayPersonName } from '@/lib/exports/format';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { filterDemoSeedJobs } from '@/lib/demo-seed-filter';
import { fetchOrganizationContext } from '@/lib/organization';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
import { supabase } from '@/lib/supabase';
import { normalizeJobStatus } from '@/lib/worker-assignment';

type Job = {
  id: string;
  title: string;
  customer_name: string | null;
  address: string | null;
  status: string | null;
  assigned_to?: string | null;
  assigned_email?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  timezone?: string | null;
  created_at?: string | null;
  revenue_amount?: number | null;
};

function jobNeedsWorker(job: Job) {
  const status = normalizeJobStatus(job.status);
  if (status === 'completed' || status === 'cancelled') return false;
  return !job.assigned_to && !job.assigned_email;
}

function jobLabel(job: Job) {
  return String(job.address || job.title || '').trim() || 'Job';
}

function formatDate(job: Job, locale: string) {
  const value = job.scheduled_start || job.start_date || job.due_date;
  if (!value) return 'Unscheduled';
  const date = job.scheduled_start ? new Date(value) : new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(job.scheduled_start && job.timezone ? { timeZone: job.timezone } : {})
  }).format(date);
}

export function JobsList() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workerNames, setWorkerNames] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoadError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));
      const org = await fetchOrganizationContext(user.id);
      setRole(normalizeRole(org?.role || profile?.role));
      const params = new URLSearchParams();
      const customer = searchParams.get('customer');
      const status = searchParams.get('status');
      const period = searchParams.get('period');
      const filter = searchParams.get('filter');
      const assignedTo = searchParams.get('assigned_to');
      const from = searchParams.get('from');
      if (customer) params.set('customer', customer);
      if (status) params.set('status', status);
      if (period) params.set('period', period);
      if (filter) params.set('filter', filter);
      if (assignedTo) params.set('assigned_to', assignedTo);
      if (from) params.set('from', from);
      const res = await fetch(`/api/jobs?${params.toString()}`, { cache: 'no-store' });
      const json = (await res.json()) as { jobs?: Job[]; error?: string };
      if (!res.ok) {
        setLoadError(json.error || 'Unable to load jobs.');
        setJobs([]);
        return;
      }
      const orgIsDemo = await fetchOrganizationIsDemo(supabase, org?.organizationId);
      setJobs(filterDemoSeedJobs(json.jobs || [], orgIsDemo));
      let workersQuery = supabase.from('workers').select('id, name, auth_user_id, email');
      if (org?.organizationId) workersQuery = workersQuery.eq('organization_id', org.organizationId);
      else workersQuery = workersQuery.eq('user_id', user.id);
      const { data: workers } = await workersQuery;
      const names: Record<string, string> = {};
      (workers || []).forEach((worker: { id: string; name: string; auth_user_id?: string | null; email?: string | null }) => {
        const label = displayPersonName(worker.name, worker.email);
        if (worker.id && label) names[worker.id] = label;
        if (worker.auth_user_id && label) names[worker.auth_user_id] = label;
      });
      setWorkerNames(names);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [router, searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const localeCode = locale === 'vi' ? 'vi-VN' : locale === 'es' ? 'es-US' : 'en-US';
  const managerView = isManagerRole(role);
  const isOwner = role === 'owner';
  const rows = useMemo(() => jobs, [jobs]);

  return (
    <AppShell plan={plan} role={role}>
      <div className="jobs-list-page">
        <PageHeader
          title={t('nav.jobs')}
          action={managerView ? <Link className="btn btn-primary" href="/jobs/new">New job</Link> : null}
        />
        <div className="jobs-filter-tabs" aria-label="Job status filters">
          <Link href="/jobs" className="jobs-filter-tab">All</Link>
          <Link href="/jobs?period=today" className="jobs-filter-tab">Today</Link>
          <Link href="/jobs?status=active" className="jobs-filter-tab">Active</Link>
          <Link href="/jobs?status=finished" className="jobs-filter-tab">Finished</Link>
        </div>
        {loadError ? <p className="auth-message auth-message-error">{loadError}</p> : null}
        {loading ? <p className="loading-state" role="status">Loading…</p> : null}
        {!loading && rows.length === 0 ? <LocalizedEmptyState emptyKey="jobs" /> : null}
        {!loading && rows.length > 0 ? (
          <div className="card jobs-table-card">
            <div className="jobs-mobile-table-wrap">
              <table className="jobs-operations-table jobs-mobile-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Address</th>
                    <th>Assigned to</th>
                    {isOwner ? <th>Customer Pay</th> : null}
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((job) => {
                    const assigned = job.assigned_to ? workerNames[job.assigned_to] : displayPersonName(null, job.assigned_email);
                    return (
                      <tr key={job.id} className="jobs-operations-row">
                        <td>{formatDate(job, localeCode)}</td>
                        <td>
                          <Link href={`/jobs/${job.id}`}>{jobLabel(job)}</Link>
                          {isOwner && job.customer_name ? <div className="jobs-secondary">{job.customer_name}</div> : null}
                        </td>
                        <td>{assigned || (jobNeedsWorker(job) ? 'Unassigned' : '\u2014')}</td>
                        {isOwner ? <td>{job.revenue_amount != null ? formatMoneyUsd(job.revenue_amount, locale) : '\u2014'}</td> : null}
                        <td><StatusPill status={job.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
