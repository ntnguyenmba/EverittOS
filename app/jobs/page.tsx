'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ExportMenu } from '@/components/export-menu';
import { useTranslation } from '@/components/locale-provider';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { canAccessFinancials } from '@/lib/finance-access';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { getBillingOpsCopy } from '@/lib/i18n/billing-ops-copy';
import { formatMoneyUsd } from '@/lib/i18n/locale-format';
import { getExportCopy } from '@/lib/i18n/export-copy';
import { displayPersonName } from '@/lib/exports/format';
import type { JobBillingStatus } from '@/lib/jobs/billing-status';
import { isAdminRole, isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { filterDemoSeedJobs } from '@/lib/demo-seed-filter';
import { fetchOrganizationContext } from '@/lib/organization';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { supabase } from '@/lib/supabase';
import { sortJobs, type JobListSortMode } from '@/lib/jobs-list-sort';
import { normalizeJobStatus } from '@/lib/worker-assignment';

const copy = {
  en: {
    newJob: 'New job', all: 'All', today: 'Today', active: 'Active', finished: 'Finished', needsWorker: 'Needs worker', filtered: 'Filtered', showAll: 'Show all', missingFinish: 'Finished jobs missing a finish date.', loading: 'Loading…', unableLoad: 'Unable to load jobs.', removeConfirm: 'Remove job "{title}"?', unableRemove: 'Unable to remove job.', noCustomer: 'No customer', photo: 'photo', photos: 'photos', maps: 'Maps', more: 'More', removing: 'Removing…', remove: 'Remove', bookAgain: 'Book again', creating: 'Creating…', date: 'Date', job: 'Job', address: 'Address', assignedTo: 'Assigned to', status: 'Status', actions: 'Actions', openJob: 'Open job', unscheduled: 'Unscheduled', unassigned: 'Needs worker', amount: 'Amount', sortBy: 'Sort by', sortByAssigned: 'Assigned worker'
  },
  es: {
    newJob: 'Nuevo trabajo', all: 'Todos', today: 'Hoy', active: 'Activos', finished: 'Finalizados', needsWorker: 'Necesita trabajador', filtered: 'Filtrado', showAll: 'Mostrar todos', missingFinish: 'Trabajos finalizados sin fecha de finalización.', loading: 'Cargando…', unableLoad: 'No se pudieron cargar los trabajos.', removeConfirm: '¿Eliminar el trabajo "{title}"?', unableRemove: 'No se pudo eliminar el trabajo.', noCustomer: 'Sin cliente', photo: 'foto', photos: 'fotos', maps: 'Mapas', more: 'Más', removing: 'Eliminando…', remove: 'Eliminar', bookAgain: 'Reservar de nuevo', creating: 'Creando…', date: 'Fecha', job: 'Trabajo', address: 'Dirección', assignedTo: 'Asignado a', status: 'Estado', actions: 'Acciones', openJob: 'Abrir trabajo', unscheduled: 'Sin programar', unassigned: 'Necesita trabajador', amount: 'Importe', sortBy: 'Ordenar por', sortByAssigned: 'Trabajador asignado'
  },
  vi: {
    newJob: 'Công việc mới', all: 'Tất cả', today: 'Hôm nay', active: 'Đang hoạt động', finished: 'Đã hoàn thành', needsWorker: 'Cần nhân sự', filtered: 'Đã lọc', showAll: 'Hiển thị tất cả', missingFinish: 'Công việc đã hoàn thành nhưng thiếu ngày hoàn tất.', loading: 'Đang tải…', unableLoad: 'Không thể tải công việc.', removeConfirm: 'Xóa công việc "{title}"?', unableRemove: 'Không thể xóa công việc.', noCustomer: 'Không có khách hàng', photo: 'ảnh', photos: 'ảnh', maps: 'Bản đồ', more: 'Thêm', removing: 'Đang xóa…', remove: 'Xóa', bookAgain: 'Đặt lại', creating: 'Đang tạo…', date: 'Ngày', job: 'Công việc', address: 'Địa chỉ', assignedTo: 'Phân công', status: 'Trạng thái', actions: 'Thao tác', openJob: 'Mở công việc', unscheduled: 'Chưa lên lịch', unassigned: 'Cần nhân sự', amount: 'Số tiền', sortBy: 'Sắp xếp theo', sortByAssigned: 'Nhân sự được giao'
  }
} as const;

type Job = {
  id: string;
  title: string;
  customer_name: string | null;
  customer_id: string | null;
  address: string | null;
  status: string | null;
  completed_at?: string | null;
  assigned_to?: string | null;
  assigned_email?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  timezone?: string | null;
  created_at?: string | null;
  revenue_amount?: number | null;
  billing_status?: JobBillingStatus | string | null;
};

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

function formatTime(job: Job, locale: string) {
  if (!job.scheduled_start) return '—';
  const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  if (job.timezone) options.timeZone = job.timezone;
  const start = new Intl.DateTimeFormat(locale, options).format(new Date(job.scheduled_start));
  if (!job.scheduled_end) return start;
  const end = new Intl.DateTimeFormat(locale, options).format(new Date(job.scheduled_end));
  return `${start} – ${end}`;
}

function invoiceHref(job: Job) {
  const params = new URLSearchParams({ jobId: job.id });
  if (job.customer_id) params.set('customerId', job.customer_id);
  return `/invoices?${params.toString()}`;
}

function canCreateInvoiceForJob(job: Job) {
  const status = String(job.status || '').toLowerCase();
  if (status === 'completed') return true;
  return Boolean(job.customer_id || job.customer_name) && Number(job.revenue_amount || 0) > 0;
}

function jobNeedsWorker(job: Pick<Job, 'status' | 'assigned_to' | 'assigned_email'>) {
  const status = normalizeJobStatus(job.status);
  if (status === 'completed' || status === 'cancelled') return false;
  return !job.assigned_to && !job.assigned_email;
}

function jobListAddress(job: Pick<Job, 'address' | 'title'>) {
  return String(job.address || '').trim() || String(job.title || '').trim();
}

function filterTabClass(active: boolean, alert = false) {
  return ['jobs-filter-tab', active ? 'jobs-filter-tab-active' : '', alert ? 'jobs-filter-tab-alert' : ''].filter(Boolean).join(' ');
}

function JobsList() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const c = copy[locale];
  const exportCopy = getExportCopy(locale);
  const billingCopy = getBillingOpsCopy(locale);
  const appFeedback = useAppFeedback();
  const searchParams = useSearchParams();
  const customerFilter = searchParams.get('customer');
  const statusFilter = searchParams.get('status');
  const periodFilter = searchParams.get('period');
  const assignmentFilter = searchParams.get('filter');
  const assignedToFilter = searchParams.get('assigned_to');
  const createdFromFilter = searchParams.get('from');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workerNames, setWorkerNames] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [removingId, setRemovingId] = useState('');
  const [duplicatingId, setDuplicatingId] = useState('');
  const [openMenuId, setOpenMenuId] = useState('');
  const [sortMode, setSortMode] = useState<JobListSortMode>('date');
  const loadingRef = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (!silent) setLoading(true);
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
      const workspaceRole = normalizeRole(org?.role || profile?.role);
      setRole(workspaceRole);
      const params = new URLSearchParams();
      if (customerFilter) params.set('customer', customerFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (periodFilter) params.set('period', periodFilter);
      if (assignmentFilter) params.set('filter', assignmentFilter);
      if (assignedToFilter) params.set('assigned_to', assignedToFilter);
      if (createdFromFilter) params.set('from', createdFromFilter);
      const res = await fetch(`/api/jobs?${params.toString()}`, { cache: 'no-store' });
      const json = (await res.json()) as { jobs?: Job[]; error?: string };
      if (!res.ok) {
        const message = json.error || c.unableLoad;
        setLoadError(message);
        if (!silent) appFeedback.error(message);
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
  }, [router, customerFilter, statusFilter, periodFilter, assignmentFilter, assignedToFilter, createdFromFilter, appFeedback, c.unableLoad]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 45000);
    const refreshOnFocus = () => { if (document.visibilityState === 'visible') void load(true); };
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!openMenuId) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest(`[data-jobs-menu="${openMenuId}"]`)) return;
      setOpenMenuId('');
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [openMenuId]);

  async function removeJob(job: Job) {
    if (!window.confirm(c.removeConfirm.replace('{title}', job.title))) return;
    setRemovingId(job.id);
    const res = await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      deletedJobIds?: string[];
      deletedJobCount?: number;
    };
    setRemovingId('');
    setOpenMenuId('');
    if (!res.ok) {
      window.alert(json.error || c.unableRemove);
      return;
    }
    appFeedback.success(json.message || 'Job removed.');
    setJobs((rows) => rows.filter((row) => row.id !== job.id));
    void load();
  }

  async function bookAgain(job: Job) {
    setDuplicatingId(job.id);
    const res = await fetch(`/api/jobs/${job.id}/duplicate`, { method: 'POST' });
    const json = (await res.json().catch(() => ({}))) as { job?: { id: string }; redirectTo?: string; error?: string };
    setDuplicatingId('');
    setOpenMenuId('');
    if (!res.ok || !json.job?.id) {
      appFeedback.error(json.error || (locale === 'es' ? 'No se pudo crear un trabajo similar.' : locale === 'vi' ? 'Không thể tạo công việc tương tự.' : 'Unable to create a similar job.'));
      return;
    }
    router.push(json.redirectTo || `/jobs/${json.job.id}?confirmSchedule=1`);
  }

  const filtered = Boolean(assignedToFilter || statusFilter || createdFromFilter || assignmentFilter || periodFilter);
  const managerView = isManagerRole(role);
  const canManageFinancials = canAccessFinancials(role, plan);
  const canExport = managerView;
  const localeCode = locale === 'vi' ? 'vi-VN' : locale === 'es' ? 'es-US' : 'en-US';
  const rows = useMemo(() => sortJobs(jobs, sortMode, workerNames, localeCode), [jobs, sortMode, workerNames, localeCode]);
  const exportQuery = useMemo(() => ({ customer: customerFilter, status: statusFilter, period: periodFilter, filter: assignmentFilter, assigned_to: assignedToFilter, from: createdFromFilter }), [customerFilter, statusFilter, periodFilter, assignmentFilter, assignedToFilter, createdFromFilter]);
  const activeAll = !periodFilter && !statusFilter && assignmentFilter !== 'unassigned';
  const activeToday = periodFilter === 'today';
  const activeActive = statusFilter === 'active';
  const activeFinished = statusFilter === 'finished' || statusFilter === 'completed';
  const activeNeedsWorker = assignmentFilter === 'unassigned';
  function openJob(jobId: string) { router.push(`/jobs/${jobId}`); }

  return (
    <AppShell plan={plan} role={role} className="jobs-shell-minimal">
      <div className="jobs-list-page">
        <PageHeader title={t('nav.jobs')} action={<div className="jobs-header-actions">{managerView ? <Link className="btn btn-secondary" href="/jobs/duplicate-cleanup">{t('pages.duplicateCleanup.findDuplicates')}</Link> : null}{canExport ? <ExportMenu endpoint="/api/exports/jobs" query={exportQuery} locale={locale} disabled={loading} onError={(message) => appFeedback.error(message || exportCopy.exportFailed)} /> : null}<Link className="btn btn-primary" href="/jobs/new">{c.newJob}</Link></div>} />
        <div className="jobs-filter-bar">
          <div className="jobs-filter-tabs" aria-label="Job filters">
            <Link href="/jobs" className={filterTabClass(activeAll)} aria-current={activeAll ? 'page' : undefined}>{c.all}</Link>
            <Link href="/jobs?period=today" className={filterTabClass(activeToday)} aria-current={activeToday ? 'page' : undefined}>{c.today}</Link>
            <Link href="/jobs?status=active" className={filterTabClass(activeActive)} aria-current={activeActive ? 'page' : undefined}>{c.active}</Link>
            <Link href="/jobs?status=finished" className={filterTabClass(activeFinished)} aria-current={activeFinished ? 'page' : undefined}>{c.finished}</Link>
            {managerView ? <Link href="/jobs?filter=unassigned" className={filterTabClass(activeNeedsWorker, true)} aria-current={activeNeedsWorker ? 'page' : undefined}>{c.needsWorker}</Link> : null}
          </div>
          <label className="jobs-sort-control">
            <span>{c.sortBy}</span>
            <select
              value={sortMode}
              aria-label={c.sortBy}
              onChange={(event) => setSortMode(event.target.value === 'assigned' ? 'assigned' : 'date')}
            >
              <option value="date">{c.date}</option>
              <option value="assigned">{c.sortByAssigned}</option>
            </select>
          </label>
        </div>
        {filtered ? <p className="muted" style={{ marginBottom: 12 }}>{c.filtered} · <Link href="/jobs">{c.showAll}</Link></p> : null}
        {isAdminRole(role) && assignmentFilter === 'missing_completion_date' ? <p className="muted" style={{ marginBottom: 12 }}>{c.missingFinish}</p> : null}
        {loadError ? <p className="auth-message auth-message-error">{loadError}</p> : null}
        {loading ? <p className="loading-state" role="status">{c.loading}</p> : null}
        {!loading && rows.length === 0 ? <LocalizedEmptyState emptyKey="jobs" /> : null}
        {!loading && rows.length > 0 ? (
          <div className="card jobs-table-card"><div className="jobs-mobile-table-wrap"><table className="jobs-operations-table jobs-mobile-table"><thead><tr>{[c.date, c.address, c.assignedTo, c.status, c.actions].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>
            {rows.map((job) => {
              const assignedName = job.assigned_to ? workerNames[job.assigned_to] : null;
              const needsWorker = jobNeedsWorker(job);
              const assignment = assignedName || displayPersonName(null, job.assigned_email) || (needsWorker ? c.unassigned : '—');
              const locationLabel = jobListAddress(job) || c.unscheduled;
              const showInvoice = canManageFinancials && canCreateInvoiceForJob(job) && String(job.billing_status || '') !== 'paid' && String(job.billing_status || '') !== 'receipt_sent';
              const menuOpen = openMenuId === job.id;
              return (
                <tr key={job.id} className="jobs-operations-row" tabIndex={0} role="link" aria-label={locationLabel} onClick={() => openJob(job.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openJob(job.id); } }}>
                  <td data-label={c.date} className="jobs-col-date"><strong>{formatDate(job, localeCode, c.unscheduled)}</strong><span className="jobs-row-time">{formatTime(job, localeCode)}</span></td>
                  <td data-label={c.address} className="jobs-col-property"><Link href={`/jobs/${job.id}`} onClick={(event) => event.stopPropagation()} className="jobs-property-link">{locationLabel}</Link>{canManageFinancials ? <div className="jobs-row-amount">{job.revenue_amount != null ? formatMoneyUsd(job.revenue_amount, locale) : '—'}</div> : null}</td>
                  <td data-label={c.assignedTo} className="jobs-col-assigned"><span className={needsWorker ? 'jobs-needs-worker' : undefined}>{assignment}</span></td>
                  <td data-label={c.status} className="jobs-col-status"><StatusPill status={job.status} /></td>
                  <td data-label={c.actions} className="jobs-col-actions" onClick={(event) => event.stopPropagation()}><div className="jobs-more-menu" data-jobs-menu={job.id}><button type="button" className="jobs-menu-trigger" aria-label={c.more} aria-haspopup="menu" aria-expanded={menuOpen} onClick={(event) => { event.stopPropagation(); setOpenMenuId(menuOpen ? '' : job.id); }}>•••</button>{menuOpen ? <div className="jobs-more-panel" role="menu"><Link href={`/jobs/${job.id}`} className="jobs-menu-item" role="menuitem" onClick={(event) => event.stopPropagation()}>{c.openJob}</Link>{job.address ? <a href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`} className="jobs-menu-item" role="menuitem" target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{c.maps}</a> : null}{managerView ? <button type="button" className="jobs-menu-item" role="menuitem" disabled={duplicatingId === job.id} onClick={(event) => { event.stopPropagation(); void bookAgain(job); }}>{duplicatingId === job.id ? c.creating : c.bookAgain}</button> : null}{showInvoice ? <Link href={invoiceHref(job)} className="jobs-menu-item" role="menuitem" onClick={(event) => event.stopPropagation()}>{billingCopy.createInvoice}</Link> : null}{managerView ? <button type="button" className="jobs-menu-item jobs-menu-danger" role="menuitem" disabled={removingId === job.id} onClick={(event) => { event.stopPropagation(); void removeJob(job); }}>{removingId === job.id ? c.removing : c.remove}</button> : null}</div> : null}</div></td>
                </tr>
              );
            })}
          </tbody></table></div></div>
        ) : null}
      </div>
    </AppShell>
  );
}

export default function JobsPage() {
  return <Suspense><JobsList /></Suspense>;
}
