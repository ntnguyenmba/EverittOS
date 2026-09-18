'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ExportMenu } from '@/components/export-menu';
import { useTranslation } from '@/components/locale-provider';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { OverflowActionMenu } from '@/components/overflow-action-menu';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { canAccessFinancials } from '@/lib/finance-access';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { getBillingOpsCopy } from '@/lib/i18n/billing-ops-copy';
import { formatMoneyUsd } from '@/lib/i18n/locale-format';
import { getExportCopy } from '@/lib/i18n/export-copy';
import { displayPersonName } from '@/lib/exports/format';
import type { JobBillingStatus } from '@/lib/jobs/billing-status';
import { isAdminRole, isClientRole, isContractorRole, isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { contractorJobDetailPath } from '@/lib/contractor-job-access';
import { clientPortalJobsPath } from '@/lib/portal-access';
import { filterDemoSeedJobs } from '@/lib/demo-seed-filter';
import { fetchOrganizationContext } from '@/lib/organization';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { supabase } from '@/lib/supabase';
import { sortJobs, type JobListSortMode } from '@/lib/jobs-list-sort';
import { normalizeJobStatus } from '@/lib/worker-assignment';

const JOBS_PAGE_SIZE = 10;

const copy = {
  en: {
    newJob: 'New job', subtitle: 'Create jobs, assign workers, and track schedule and pay.', all: 'All', today: 'Today', active: 'Active', finished: 'Finished', needsWorker: 'Needs worker', filtered: 'Filtered', showAll: 'Show all', missingFinish: 'Finished jobs missing a finish date.', loading: 'Loading…', unableLoad: 'Unable to load jobs.', removeConfirm: 'Remove job "{title}"?', unableRemove: 'Unable to remove job.', noCustomer: 'No customer', maps: 'Maps', more: 'More', removing: 'Removing…', remove: 'Remove', bookAgain: 'Book again', creating: 'Creating…', date: 'Date', address: 'Address', assignedTo: 'Assigned to', customerPay: 'Customer Pay', contractorPay: 'Contractor Pay', ownerProfit: 'Owner Profit', status: 'Status', actions: 'Actions', openJob: 'Open job', unscheduled: 'Unscheduled', unassigned: 'Unassigned', sortBy: 'Sort', sortByAssigned: 'Assigned worker', filters: 'Filter jobs', moreFilters: 'More filters', worker: 'Worker', allWorkers: 'All workers', client: 'Client', allClients: 'All clients', property: 'Property', allProperties: 'All properties', month: 'Month', allMonths: 'All months', year: 'Year', allYears: 'All years', clearFilters: 'Clear filters', showMore: 'Show 10 more', showing: 'Showing {visible} of {total}'
  },
  es: {
    newJob: 'Nuevo trabajo', subtitle: 'Cree trabajos, asigne personal y siga el horario y los pagos.', all: 'Todos', today: 'Hoy', active: 'Activos', finished: 'Finalizados', needsWorker: 'Necesita trabajador', filtered: 'Filtrado', showAll: 'Mostrar todos', missingFinish: 'Trabajos finalizados sin fecha de finalización.', loading: 'Cargando…', unableLoad: 'No se pudieron cargar los trabajos.', removeConfirm: '¿Eliminar el trabajo "{title}"?', unableRemove: 'No se pudo eliminar el trabajo.', noCustomer: 'Sin cliente', maps: 'Mapas', more: 'Más', removing: 'Eliminando…', remove: 'Eliminar', bookAgain: 'Reservar de nuevo', creating: 'Creando…', date: 'Fecha', address: 'Dirección', assignedTo: 'Asignado a', customerPay: 'Pago del cliente', contractorPay: 'Pago al contratista', ownerProfit: 'Ganancia del propietario', status: 'Estado', actions: 'Acciones', openJob: 'Abrir trabajo', unscheduled: 'Sin programar', unassigned: 'Sin asignar', sortBy: 'Ordenar', sortByAssigned: 'Trabajador asignado', filters: 'Filtrar trabajos', moreFilters: 'Más filtros', worker: 'Trabajador', allWorkers: 'Todos los trabajadores', client: 'Cliente', allClients: 'Todos los clientes', property: 'Propiedad', allProperties: 'Todas las propiedades', month: 'Mes', allMonths: 'Todos los meses', year: 'Año', allYears: 'Todos los años', clearFilters: 'Borrar filtros', showMore: 'Mostrar 10 más', showing: 'Mostrando {visible} de {total}'
  },
  vi: {
    newJob: 'Công việc mới', subtitle: 'Tạo việc, giao nhân sự và theo dõi lịch cùng thanh toán.', all: 'Tất cả', today: 'Hôm nay', active: 'Đang hoạt động', finished: 'Đã hoàn thành', needsWorker: 'Cần nhân sự', filtered: 'Đã lọc', showAll: 'Hiển thị tất cả', missingFinish: 'Công việc đã hoàn thành nhưng thiếu ngày hoàn tất.', loading: 'Đang tải…', unableLoad: 'Không thể tải công việc.', removeConfirm: 'Xóa công việc "{title}"?', unableRemove: 'Không thể xóa công việc.', noCustomer: 'Không có khách hàng', maps: 'Bản đồ', more: 'Thêm', removing: 'Đang xóa…', remove: 'Xóa', bookAgain: 'Đặt lại', creating: 'Đang tạo…', date: 'Ngày', address: 'Địa chỉ', assignedTo: 'Phân công', customerPay: 'Khách trả', contractorPay: 'Trả nhà thầu', ownerProfit: 'Lợi nhuận chủ', status: 'Trạng thái', actions: 'Thao tác', openJob: 'Mở công việc', unscheduled: 'Chưa lên lịch', unassigned: 'Chưa phân công', sortBy: 'Sắp xếp', sortByAssigned: 'Nhân sự được giao', filters: 'Lọc công việc', moreFilters: 'Bộ lọc khác', worker: 'Nhân sự', allWorkers: 'Tất cả nhân sự', client: 'Khách hàng', allClients: 'Tất cả khách hàng', property: 'Địa điểm', allProperties: 'Tất cả địa điểm', month: 'Tháng', allMonths: 'Tất cả tháng', year: 'Năm', allYears: 'Tất cả năm', clearFilters: 'Xóa bộ lọc', showMore: 'Hiển thị thêm 10', showing: 'Đang hiển thị {visible} trên {total}'
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

type OwnerJobFinancials = {
  customerPay: number | null;
  contractorPay: number | null;
  ownerProfit: number | null;
};

function formatOwnerJobMoney(value: number | null | undefined, locale: string) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return formatMoneyUsd(value, locale);
}

function formatDate(job: Job, locale: string, unscheduled: string) {
  const value = job.scheduled_start || job.start_date || job.due_date;
  if (!value) return unscheduled;
  const date = job.scheduled_start ? new Date(value) : new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
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

function jobDateValue(job: Job) {
  const value = job.scheduled_start || job.start_date || job.due_date || job.created_at;
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function jobDetailHref(role: UserRole, jobId: string) {
  if (isContractorRole(role)) return contractorJobDetailPath(jobId);
  if (isClientRole(role)) return clientPortalJobsPath(jobId);
  return `/jobs/${jobId}`;
}

function filterTabClass(active: boolean, alert = false) {
  return ['jobs-filter-tab', active ? 'jobs-filter-tab-active' : '', alert ? 'jobs-filter-tab-alert' : ''].filter(Boolean).join(' ');
}

export function JobsList() {
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
  const [ownerFinancials, setOwnerFinancials] = useState<Record<string, OwnerJobFinancials>>({});
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [removingId, setRemovingId] = useState('');
  const [duplicatingId, setDuplicatingId] = useState('');
  const [openMenuId, setOpenMenuId] = useState('');
  const [sortMode, setSortMode] = useState<JobListSortMode>('date');
  const [workerFilter, setWorkerFilter] = useState(assignmentFilter === 'unassigned' ? '__unassigned__' : '');
  const [clientFilter, setClientFilter] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [visibleCount, setVisibleCount] = useState(JOBS_PAGE_SIZE);
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
        setOwnerFinancials({});
        return;
      }
      const orgIsDemo = await fetchOrganizationIsDemo(supabase, org?.organizationId);
      const visibleJobs = filterDemoSeedJobs(json.jobs || [], orgIsDemo);
      setJobs(visibleJobs);

      if (workspaceRole === 'owner' && visibleJobs.length) {
        const ids = visibleJobs.map((job) => job.id).filter(Boolean);
        const merged: Record<string, OwnerJobFinancials> = {};
        let loaded = true;
        for (let index = 0; index < ids.length; index += 250) {
          const chunk = ids.slice(index, index + 250);
          const financialRes = await fetch(`/api/jobs/owner-financials?ids=${encodeURIComponent(chunk.join(','))}`, { cache: 'no-store' });
          if (!financialRes.ok) {
            loaded = false;
            break;
          }
          const financialJson = (await financialRes.json()) as { financials?: Record<string, OwnerJobFinancials> };
          Object.assign(merged, financialJson.financials || {});
        }
        setOwnerFinancials(loaded ? merged : {});
      } else {
        setOwnerFinancials({});
      }

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
    setVisibleCount(JOBS_PAGE_SIZE);
  }, [customerFilter, statusFilter, periodFilter, assignmentFilter, assignedToFilter, createdFromFilter, workerFilter, clientFilter, propertyFilter, monthFilter, yearFilter, sortMode]);

  async function removeJob(job: Job) {
    if (!window.confirm(c.removeConfirm.replace('{title}', job.title))) return;
    setRemovingId(job.id);
    const res = await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' });
    const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    setRemovingId('');
    setOpenMenuId('');
    if (!res.ok) {
      window.alert(json.error || c.unableRemove);
      return;
    }
    appFeedback.success(json.message || 'Job removed.');
    setJobs((rows) => rows.filter((row) => row.id !== job.id));
    setOwnerFinancials((rows) => {
      const next = { ...rows };
      delete next[job.id];
      return next;
    });
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

  const managerView = isManagerRole(role);
  const isOwner = role === 'owner';
  const canManageFinancials = canAccessFinancials(role, plan);
  const canExport = managerView;
  const localeCode = locale === 'vi' ? 'vi-VN' : locale === 'es' ? 'es-US' : 'en-US';

  const workerOptions = useMemo(() => {
    const options = new Map<string, string>();
    jobs.forEach((job) => {
      if (job.assigned_to) options.set(job.assigned_to, workerNames[job.assigned_to] || job.assigned_email || job.assigned_to);
      else if (job.assigned_email) options.set(`email:${job.assigned_email}`, displayPersonName(null, job.assigned_email));
    });
    return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1], localeCode));
  }, [jobs, workerNames, localeCode]);

  const clientOptions = useMemo(() => [...new Set(jobs.map((job) => String(job.customer_name || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, localeCode)), [jobs, localeCode]);
  const propertyOptions = useMemo(() => [...new Set(jobs.map((job) => jobListAddress(job)).filter(Boolean))].sort((a, b) => a.localeCompare(b, localeCode)), [jobs, localeCode]);
  const yearOptions = useMemo(() => [...new Set(jobs.map(jobDateValue).filter((d): d is Date => Boolean(d)).map((date) => String(date.getFullYear())))].sort((a, b) => Number(b) - Number(a)), [jobs]);

  const filteredJobs = useMemo(() => jobs.filter((job) => {
    if (workerFilter === '__unassigned__' && !jobNeedsWorker(job)) return false;
    if (workerFilter && workerFilter !== '__unassigned__') {
      const matchesWorker = workerFilter.startsWith('email:')
        ? job.assigned_email === workerFilter.slice(6)
        : job.assigned_to === workerFilter;
      if (!matchesWorker) return false;
    }
    if (clientFilter && String(job.customer_name || '').trim() !== clientFilter) return false;
    if (propertyFilter && jobListAddress(job) !== propertyFilter) return false;
    const date = jobDateValue(job);
    if (monthFilter && (!date || String(date.getMonth() + 1).padStart(2, '0') !== monthFilter)) return false;
    if (yearFilter && (!date || String(date.getFullYear()) !== yearFilter)) return false;
    return true;
  }), [jobs, workerFilter, clientFilter, propertyFilter, monthFilter, yearFilter]);

  const rows = useMemo(() => sortJobs(filteredJobs, sortMode, workerNames, localeCode), [filteredJobs, sortMode, workerNames, localeCode]);
  const visibleRows = rows.slice(0, visibleCount);
  const hasMoreRows = visibleCount < rows.length;
  const hasLocalFilters = Boolean(workerFilter || clientFilter || propertyFilter || monthFilter || yearFilter);
  const filtered = Boolean(assignedToFilter || statusFilter || createdFromFilter || assignmentFilter || periodFilter || hasLocalFilters);
  const exportQuery = useMemo(() => ({ customer: customerFilter, status: statusFilter, period: periodFilter, filter: assignmentFilter, assigned_to: assignedToFilter, from: createdFromFilter }), [customerFilter, statusFilter, periodFilter, assignmentFilter, assignedToFilter, createdFromFilter]);
  const activeAll = !periodFilter && !statusFilter && assignmentFilter !== 'unassigned';
  const activeToday = periodFilter === 'today';
  const activeActive = statusFilter === 'active';
  const activeFinished = statusFilter === 'finished' || statusFilter === 'completed';
  const activeNeedsWorker = assignmentFilter === 'unassigned';

  function clearLocalFilters() {
    setWorkerFilter('');
    setClientFilter('');
    setPropertyFilter('');
    setMonthFilter('');
    setYearFilter('');
  }

  return (
    <AppShell plan={plan} role={role} className="jobs-shell-minimal">
      <div className="jobs-list-page">
        <PageHeader title={t('nav.jobs')} subtitle={c.subtitle} action={managerView ? <div className="jobs-header-actions">{managerView ? <Link className="btn btn-secondary" href="/jobs/duplicate-cleanup">{t('pages.duplicateCleanup.findDuplicates')}</Link> : null}{canExport ? <ExportMenu endpoint="/api/exports/jobs" query={exportQuery} locale={locale} disabled={loading} onError={(message) => appFeedback.error(message || exportCopy.exportFailed)} onSuccess={(format) => { if (format === 'share') appFeedback.success(exportCopy.shareSent); }} /> : null}<Link className="btn btn-primary" href="/jobs/new">{c.newJob}</Link></div> : null} />

        <div className="jobs-filter-tabs" aria-label="Job status filters">
          <Link href="/jobs" className={filterTabClass(activeAll)} aria-current={activeAll ? 'page' : undefined}>{c.all}</Link>
          <Link href="/jobs?period=today" className={filterTabClass(activeToday)} aria-current={activeToday ? 'page' : undefined}>{c.today}</Link>
          <Link href="/jobs?status=active" className={filterTabClass(activeActive)} aria-current={activeActive ? 'page' : undefined}>{c.active}</Link>
          <Link href="/jobs?status=finished" className={filterTabClass(activeFinished)} aria-current={activeFinished ? 'page' : undefined}>{c.finished}</Link>
          {managerView ? <Link href="/jobs?filter=unassigned" className={filterTabClass(activeNeedsWorker, true)} aria-current={activeNeedsWorker ? 'page' : undefined}>{c.needsWorker}</Link> : null}
        </div>

        <section className="jobs-advanced-filters" aria-label={c.filters} style={{ marginBlock: 8 }}>
          <div className="jobs-filter-heading" style={{ marginBottom: 8 }}>{c.filters}</div>
          <div className="jobs-filter-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            <label className="jobs-filter-control"><span>{c.worker}</span><select value={workerFilter} onChange={(event) => setWorkerFilter(event.target.value)}><option value="">{c.allWorkers}</option><option value="__unassigned__">{c.unassigned}</option>{workerOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="jobs-filter-control"><span>{c.client}</span><select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}><option value="">{c.allClients}</option>{clientOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
            <label className="jobs-filter-control"><span>{c.property}</span><select value={propertyFilter} onChange={(event) => setPropertyFilter(event.target.value)}><option value="">{c.allProperties}</option>{propertyOptions.map((property) => <option key={property} value={property}>{property}</option>)}</select></label>
          </div>

          <details style={{ marginTop: 10 }} open={Boolean(monthFilter || yearFilter || sortMode !== 'date') || undefined}>
            <summary className="btn" style={{ width: 'fit-content', cursor: 'pointer', listStyle: 'none' }}>{c.moreFilters}</summary>
            <div className="jobs-filter-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 10 }}>
              <label className="jobs-filter-control"><span>{c.month}</span><select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}><option value="">{c.allMonths}</option>{Array.from({ length: 12 }, (_, index) => { const value = String(index + 1).padStart(2, '0'); const label = new Intl.DateTimeFormat(localeCode, { month: 'long' }).format(new Date(2026, index, 1)); return <option key={value} value={value}>{label}</option>; })}</select></label>
              <label className="jobs-filter-control"><span>{c.year}</span><select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}><option value="">{c.allYears}</option>{yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
              <label className="jobs-filter-control"><span>{c.sortBy}</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value === 'assigned' ? 'assigned' : 'date')}><option value="date">{c.date}</option><option value="assigned">{c.sortByAssigned}</option></select></label>
            </div>
          </details>

          {hasLocalFilters ? <button type="button" className="btn jobs-clear-filters" style={{ marginTop: 10 }} onClick={clearLocalFilters}>{c.clearFilters}</button> : null}
        </section>

        {filtered ? <p className="muted jobs-filter-summary">{c.filtered}{!hasLocalFilters ? <> · <Link href="/jobs">{c.showAll}</Link></> : null}</p> : null}
        {isAdminRole(role) && assignmentFilter === 'missing_completion_date' ? <p className="muted jobs-filter-summary">{c.missingFinish}</p> : null}
        {loadError ? <p className="auth-message auth-message-error">{loadError}</p> : null}
        {loading ? <p className="loading-state" role="status">{c.loading}</p> : null}
        {!loading && rows.length === 0 ? <LocalizedEmptyState emptyKey="jobs" /> : null}
        {!loading && rows.length > 0 ? (
          <>
            <div className="card jobs-table-card"><div className="jobs-mobile-table-wrap"><table className={`jobs-operations-table jobs-mobile-table${isOwner ? ' jobs-operations-table-owner-finance' : ''}`}><thead><tr>{(isOwner ? [c.date, c.address, c.assignedTo, c.customerPay, c.contractorPay, c.ownerProfit, c.status, c.actions] : [c.date, c.address, c.assignedTo, c.status, c.actions]).map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>
              {visibleRows.map((job) => {
                const assignedName = job.assigned_to ? workerNames[job.assigned_to] : null;
                const needsWorker = jobNeedsWorker(job);
                const assignment = assignedName || displayPersonName(null, job.assigned_email) || (needsWorker ? c.unassigned : '—');
                const locationLabel = jobListAddress(job) || c.unscheduled;
                const showInvoice = canManageFinancials && canCreateInvoiceForJob(job) && String(job.billing_status || '') !== 'paid' && String(job.billing_status || '') !== 'receipt_sent';
                const menuOpen = openMenuId === job.id;
                const ownerMoney = isOwner ? ownerFinancials[job.id] : undefined;
                return (
                  <tr key={job.id} className={`jobs-operations-row open-in-new-tab-card${isOwner ? ' jobs-owner-finance-row' : ''}`}>
                    <td data-label={c.date} className="jobs-col-date"><Link href={jobDetailHref(role, job.id)} target="_blank" rel="noopener noreferrer" className="record-card-overlay-link" aria-label={`Open ${locationLabel} in a new tab`}><span className="record-card-overlay-label">Open {locationLabel} in a new tab</span></Link><strong>{formatDate(job, localeCode, c.unscheduled)}</strong><span className="jobs-row-time">{formatTime(job, localeCode)}</span></td>
                    <td data-label={c.address} className="jobs-col-property"><Link href={jobDetailHref(role, job.id)} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} className="jobs-property-link">{locationLabel}</Link>{isOwner && job.customer_name ? <div className="jobs-secondary">{c.client}: {job.customer_name}</div> : null}{canManageFinancials && !isOwner ? <div className="jobs-row-amount">{job.revenue_amount != null ? formatMoneyUsd(job.revenue_amount, locale) : '—'}</div> : null}</td>
                    <td data-label={c.assignedTo} className="jobs-col-assigned"><span className={needsWorker ? 'jobs-needs-worker' : undefined}>{assignment}</span></td>
                    {isOwner ? (
                      <>
                        <td data-label={c.customerPay} className="jobs-col-money jobs-col-customer-pay"><span className="jobs-money-label">{c.customerPay}&nbsp;</span><span className="jobs-money-value">{formatOwnerJobMoney(ownerMoney?.customerPay, locale)}</span></td>
                        <td data-label={c.contractorPay} className="jobs-col-money jobs-col-contractor-pay"><span className="jobs-money-label">{c.contractorPay}&nbsp;</span><span className="jobs-money-value">{formatOwnerJobMoney(ownerMoney?.contractorPay, locale)}</span></td>
                        <td data-label={c.ownerProfit} className="jobs-col-money jobs-col-owner-profit"><span className="jobs-money-label">{c.ownerProfit}&nbsp;</span><span className="jobs-money-value">{formatOwnerJobMoney(ownerMoney?.ownerProfit, locale)}</span></td>
                      </>
                    ) : null}
                    <td data-label={c.status} className="jobs-col-status"><StatusPill status={job.status} /></td>
                    <td data-label={c.actions} className="jobs-col-actions" onClick={(event) => event.stopPropagation()}><OverflowActionMenu label={c.more} open={menuOpen} onOpenChange={(nextOpen) => setOpenMenuId(nextOpen ? job.id : '')}><Link href={jobDetailHref(role, job.id)} target="_blank" rel="noopener noreferrer" className="jobs-menu-item" role="menuitem" onClick={() => setOpenMenuId('')}>{c.openJob}</Link>{job.address ? <a href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`} className="jobs-menu-item" role="menuitem" target="_blank" rel="noreferrer" onClick={() => setOpenMenuId('')}>{c.maps}</a> : null}{managerView ? <button type="button" className="jobs-menu-item" role="menuitem" disabled={duplicatingId === job.id} onClick={() => void bookAgain(job)}>{duplicatingId === job.id ? c.creating : c.bookAgain}</button> : null}{showInvoice ? <Link href={invoiceHref(job)} className="jobs-menu-item" role="menuitem" onClick={() => setOpenMenuId('')}>{billingCopy.createInvoice}</Link> : null}{managerView ? <button type="button" className="jobs-menu-item jobs-menu-danger" role="menuitem" disabled={removingId === job.id} onClick={() => void removeJob(job)}>{removingId === job.id ? c.removing : c.remove}</button> : null}</OverflowActionMenu></td>
                  </tr>
                );
              })}
            </tbody></table></div></div>
            <div className="jobs-list-more" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
              <span className="muted">{c.showing.replace('{visible}', String(Math.min(visibleCount, rows.length))).replace('{total}', String(rows.length))}</span>
              {hasMoreRows ? <button type="button" className="btn btn-secondary" onClick={() => setVisibleCount((count) => count + JOBS_PAGE_SIZE)}>{c.showMore}</button> : null}
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
