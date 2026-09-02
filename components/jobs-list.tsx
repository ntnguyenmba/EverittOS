'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useTranslation } from '@/components/locale-provider';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { contractorJobDetailPath } from '@/lib/contractor-job-access';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { formatMoneyUsd } from '@/lib/i18n/locale-format';
import { displayPersonName } from '@/lib/exports/format';
import { clientPortalJobsPath } from '@/lib/portal-access';
import { isClientRole, isContractorRole, isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { filterDemoSeedJobs } from '@/lib/demo-seed-filter';
import { fetchOrganizationContext } from '@/lib/organization';
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

const JOB_SELECT = 'id, title, customer_name, address, status, assigned_to, assigned_email, start_date, due_date, scheduled_start, scheduled_end, timezone, created_at, revenue_amount';
const LOAD_TIMEOUT_MS = 8000;

const jobsCopy = {
  en: { newJob:'New job', all:'All', today:'Today', active:'Active', finished:'Finished', loading:'Loading…', tryAgain:'Try again', date:'Date', address:'Address', assignedTo:'Assigned to', customerPay:'Customer Pay', status:'Status', details:'Details', open:'Open', unassigned:'Unassigned', unscheduled:'Unscheduled', job:'Job' },
  es: { newJob:'Nuevo trabajo', all:'Todos', today:'Hoy', active:'Activos', finished:'Terminados', loading:'Cargando…', tryAgain:'Intentar de nuevo', date:'Fecha', address:'Dirección', assignedTo:'Asignado a', customerPay:'Pago del cliente', status:'Estado', details:'Detalles', open:'Abrir', unassigned:'Sin asignar', unscheduled:'Sin programar', job:'Trabajo' },
  vi: { newJob:'Công việc mới', all:'Tất cả', today:'Hôm nay', active:'Đang làm', finished:'Đã xong', loading:'Đang tải…', tryAgain:'Thử lại', date:'Ngày', address:'Địa chỉ', assignedTo:'Giao cho', customerPay:'Khách trả', status:'Trạng thái', details:'Chi tiết', open:'Mở', unassigned:'Chưa giao', unscheduled:'Chưa lịch', job:'Công việc' }
} as const;

function jobNeedsWorker(job: Job) {
  const status = normalizeJobStatus(job.status);
  if (status === 'completed' || status === 'cancelled') return false;
  return !job.assigned_to && !job.assigned_email;
}

function jobLabel(job: Job, fallback: string) {
  return String(job.address || job.title || '').trim() || fallback;
}

function formatDate(job: Job, locale: string, unscheduled: string) {
  const value = job.scheduled_start || job.start_date || job.due_date;
  if (!value) return unscheduled;
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

function jobDetailHref(role: UserRole, jobId: string) {
  if (isContractorRole(role)) return contractorJobDetailPath(jobId);
  if (isClientRole(role)) return clientPortalJobsPath(jobId);
  return `/jobs/${jobId}`;
}

async function withTimeout<T>(task: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Jobs took too long to load.')), ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function JobsList() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const c = jobsCopy[locale] || jobsCopy.en;
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workerNames, setWorkerNames] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    setLoading(true);
    try {
      const { data: { user } } = await withTimeout(Promise.resolve(supabase.auth.getUser()), LOAD_TIMEOUT_MS);
      if (!user) {
        router.push('/login');
        setLoading(false);
        return;
      }

      const [{ data: profile }] = await Promise.all([
        supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle()
      ]);
      setPlan(normalizePlan(profile?.plan));

      let organizationId: string | null = null;
      let nextRole = normalizeRole(profile?.role);
      try {
        const org = await withTimeout(fetchOrganizationContext(user.id), 4000);
        organizationId = org?.organizationId || null;
        nextRole = normalizeRole(org?.role || profile?.role);
      } catch {
        nextRole = normalizeRole(profile?.role);
      }
      setRole(nextRole);

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

      let loaded: Job[] = [];
      try {
        const res = await withTimeout(fetch(`/api/jobs?${params.toString()}`, { cache: 'no-store' }), LOAD_TIMEOUT_MS);
        const json = (await res.json()) as { jobs?: Job[]; error?: string };
        if (!res.ok) throw new Error(json.error || 'Unable to load jobs.');
        loaded = json.jobs || [];
      } catch {
        let query = supabase.from('jobs').select(JOB_SELECT).order('scheduled_start', { ascending: false }).limit(200);
        if (organizationId) query = query.eq('organization_id', organizationId);
        else query = query.eq('user_id', user.id);
        const { data, error } = await query;
        if (error) throw error;
        loaded = (data || []) as Job[];
      }

      setJobs(filterDemoSeedJobs(loaded, false));
      setLoading(false);

      void (async () => {
        try {
          let workersQuery = supabase.from('workers').select('id, name, auth_user_id, email');
          workersQuery = organizationId
            ? workersQuery.eq('organization_id', organizationId)
            : workersQuery.eq('user_id', user.id);
          const { data: workers } = await workersQuery;
          const names: Record<string, string> = {};
          (workers || []).forEach((worker: { id: string; name: string; auth_user_id?: string | null; email?: string | null }) => {
            const label = displayPersonName(worker.name, worker.email);
            if (worker.id && label) names[worker.id] = label;
            if (worker.auth_user_id && label) names[worker.auth_user_id] = label;
          });
          setWorkerNames(names);
        } catch {
          /* job rows still render without worker names */
        }
      })();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load jobs.');
      setJobs([]);
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
          action={managerView ? <Link className="btn btn-primary" href="/jobs/new">{c.newJob}</Link> : null}
        />
        <div className="jobs-filter-tabs" aria-label={t('nav.jobs')}>
          <Link href="/jobs" className="jobs-filter-tab">{c.all}</Link>
          <Link href="/jobs?period=today" className="jobs-filter-tab">{c.today}</Link>
          <Link href="/jobs?status=active" className="jobs-filter-tab">{c.active}</Link>
          <Link href="/jobs?status=finished" className="jobs-filter-tab">{c.finished}</Link>
        </div>
        {loadError ? (
          <div className="card">
            <p className="auth-message auth-message-error">{loadError}</p>
            <button type="button" className="btn" onClick={() => void load()}>{c.tryAgain}</button>
          </div>
        ) : null}
        {loading ? <p className="loading-state" role="status">{c.loading}</p> : null}
        {!loading && rows.length === 0 && !loadError ? <LocalizedEmptyState emptyKey="jobs" /> : null}
        {!loading && rows.length > 0 ? (
          <div className="card jobs-table-card">
            <div className="jobs-mobile-table-wrap">
              <table className="jobs-operations-table jobs-mobile-table">
                <thead>
                  <tr>
                    <th>{c.date}</th>
                    <th>{c.address}</th>
                    <th>{c.assignedTo}</th>
                    {isOwner ? <th>{c.customerPay}</th> : null}
                    <th>{c.status}</th>
                    <th>{c.details}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((job) => {
                    const assigned = job.assigned_to ? workerNames[job.assigned_to] : displayPersonName(null, job.assigned_email);
                    const href = jobDetailHref(role, job.id);
                    return (
                      <tr
                        key={job.id}
                        className="jobs-operations-row"
                        role="link"
                        tabIndex={0}
                        onClick={() => router.push(href)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            router.push(href);
                          }
                        }}
                      >
                        <td>{formatDate(job, localeCode, c.unscheduled)}</td>
                        <td>
                          <Link href={href} className="jobs-property-link" onClick={(event) => event.stopPropagation()}>
                            {jobLabel(job, c.job)}
                          </Link>
                          {isOwner && job.customer_name ? <div className="jobs-secondary">{job.customer_name}</div> : null}
                        </td>
                        <td>{assigned || (jobNeedsWorker(job) ? c.unassigned : '-')}</td>
                        {isOwner ? <td>{job.revenue_amount != null ? formatMoneyUsd(job.revenue_amount, locale) : '-'}</td> : null}
                        <td><StatusPill status={job.status} /></td>
                        <td>
                          <Link className="btn btn-sm" href={href} onClick={(event) => event.stopPropagation()}>
                            {c.open}
                          </Link>
                        </td>
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
