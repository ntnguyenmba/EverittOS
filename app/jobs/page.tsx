'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
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

const copy = {
  en: {
    newJob: 'New job', all: 'All', today: 'Today', active: 'Active', finished: 'Finished', needsWorker: 'Needs worker',
    filtered: 'Filtered', showAll: 'Show all', missingFinish: 'Finished jobs missing a finish date.', loading: 'Loading…',
    unableLoad: 'Unable to load jobs.', removeConfirm: 'Remove job "{title}"?', unableRemove: 'Unable to remove job.',
    noCustomer: 'No customer', noAddress: 'No address', photo: 'photo', photos: 'photos', maps: 'Maps',
    more: 'More', removing: 'Removing…', remove: 'Remove', bookAgain: 'Book again', creating: 'Creating…',
    date: 'Date', time: 'Time', property: 'Property', customer: 'Customer', assignedTo: 'Assigned to', status: 'Status', actions: 'Actions',
    unscheduled: 'Unscheduled', unassigned: 'Needs worker', liveNote: 'Statuses refresh automatically.'
  },
  es: {
    newJob: 'Nuevo trabajo', all: 'Todos', today: 'Hoy', active: 'Activos', finished: 'Finalizados', needsWorker: 'Necesita trabajador',
    filtered: 'Filtrado', showAll: 'Mostrar todos', missingFinish: 'Trabajos finalizados sin fecha de finalización.', loading: 'Cargando…',
    unableLoad: 'No se pudieron cargar los trabajos.', removeConfirm: '¿Eliminar el trabajo "{title}"?', unableRemove: 'No se pudo eliminar el trabajo.',
    noCustomer: 'Sin cliente', noAddress: 'Sin dirección', photo: 'foto', photos: 'fotos', maps: 'Mapas',
    more: 'Más', removing: 'Eliminando…', remove: 'Eliminar', bookAgain: 'Reservar de nuevo', creating: 'Creando…',
    date: 'Fecha', time: 'Hora', property: 'Propiedad', customer: 'Cliente', assignedTo: 'Asignado a', status: 'Estado', actions: 'Acciones',
    unscheduled: 'Sin programar', unassigned: 'Necesita trabajador', liveNote: 'Los estados se actualizan automáticamente.'
  },
  vi: {
    newJob: 'Công việc mới', all: 'Tất cả', today: 'Hôm nay', active: 'Đang hoạt động', finished: 'Đã hoàn thành', needsWorker: 'Cần nhân sự',
    filtered: 'Đã lọc', showAll: 'Hiển thị tất cả', missingFinish: 'Công việc đã hoàn thành nhưng thiếu ngày hoàn tất.', loading: 'Đang tải…',
    unableLoad: 'Không thể tải công việc.', removeConfirm: 'Xóa công việc "{title}"?', unableRemove: 'Không thể xóa công việc.',
    noCustomer: 'Không có khách hàng', noAddress: 'Không có địa chỉ', photo: 'ảnh', photos: 'ảnh', maps: 'Bản đồ',
    more: 'Thêm', removing: 'Đang xóa…', remove: 'Xóa', bookAgain: 'Đặt lại', creating: 'Đang tạo…',
    date: 'Ngày', time: 'Giờ', property: 'Địa điểm', customer: 'Khách hàng', assignedTo: 'Phân công', status: 'Trạng thái', actions: 'Thao tác',
    unscheduled: 'Chưa lên lịch', unassigned: 'Cần nhân sự', liveNote: 'Trạng thái được tự động cập nhật.'
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
  photo_count?: number;
};

function formatDate(job: Job, locale: string, unscheduled: string) {
  const value = job.scheduled_start || job.start_date || job.due_date;
  if (!value) return unscheduled;
  const date = job.scheduled_start ? new Date(value) : new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short', month: 'short', day: 'numeric',
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

function sortJobs(rows: Job[]) {
  return [...rows].sort((a, b) => {
    const aValue = a.scheduled_start || a.start_date || a.due_date;
    const bValue = b.scheduled_start || b.start_date || b.due_date;
    if (!aValue && !bValue) return a.title.localeCompare(b.title);
    if (!aValue) return 1;
    if (!bValue) return -1;
    return aValue.localeCompare(bValue);
  });
}

function JobsList() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const c = copy[locale];
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

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError('');
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
      setLoading(false);
      return;
    }

    const orgIsDemo = await fetchOrganizationIsDemo(supabase, org?.organizationId);
    const rows = filterDemoSeedJobs(json.jobs || [], orgIsDemo);
    const photoCounts = await fetchPhotoCountsByJobIds(rows.map((job) => job.id));
    setJobs(sortJobs(rows.map((job) => ({ ...job, photo_count: photoCounts[job.id] || 0 }))));

    let workersQuery = supabase.from('workers').select('id, name, auth_user_id');
    if (org?.organizationId) workersQuery = workersQuery.eq('organization_id', org.organizationId);
    else workersQuery = workersQuery.eq('user_id', user.id);
    const { data: workers } = await workersQuery;
    const names: Record<string, string> = {};
    (workers || []).forEach((worker: { id: string; name: string; auth_user_id?: string | null }) => {
      if (worker.id) names[worker.id] = worker.name;
      if (worker.auth_user_id) names[worker.auth_user_id] = worker.name;
    });
    setWorkerNames(names);
    setLoading(false);
  }, [router, customerFilter, statusFilter, periodFilter, assignmentFilter, assignedToFilter, createdFromFilter, appFeedback, c.unableLoad]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 30000);
    const refreshOnFocus = () => void load(true);
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [load]);

  async function removeJob(job: Job) {
    if (!window.confirm(c.removeConfirm.replace('{title}', job.title))) return;
    setRemovingId(job.id);
    const res = await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' });
    setRemovingId('');
    if (!res.ok) {
      const json = await res.json();
      window.alert(json.error || c.unableRemove);
      return;
    }
    setJobs((rows) => rows.filter((row) => row.id !== job.id));
  }

  async function bookAgain(job: Job) {
    setDuplicatingId(job.id);
    const res = await fetch(`/api/jobs/${job.id}/duplicate`, { method: 'POST' });
    const json = (await res.json().catch(() => ({}))) as { job?: { id: string }; redirectTo?: string; error?: string };
    setDuplicatingId('');
    if (!res.ok || !json.job?.id) {
      appFeedback.error(json.error || 'Unable to create a similar job.');
      return;
    }
    router.push(json.redirectTo || `/jobs/${json.job.id}?confirmSchedule=1`);
  }

  const filtered = Boolean(assignedToFilter || statusFilter || createdFromFilter || assignmentFilter);
  const managerView = isManagerRole(role);
  const localeCode = locale === 'vi' ? 'vi-VN' : locale === 'es' ? 'es-US' : 'en-US';
  const rows = useMemo(() => sortJobs(jobs), [jobs]);

  return (
    <AppShell plan={plan} role={role}>
      <div className="jobs-list-page">
        <PageHeader title={t('nav.jobs')} action={<Link className="btn btn-primary" href="/jobs/new">{c.newJob}</Link>} />

        <div className="button-row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
          <Link href="/jobs" className="btn">{c.all}</Link>
          <Link href="/jobs?period=today" className="btn">{c.today}</Link>
          <Link href="/jobs?status=active" className="btn">{c.active}</Link>
          <Link href="/jobs?status=completed" className="btn">{c.finished}</Link>
          {managerView ? <Link href="/jobs?filter=unassigned" className="btn">{c.needsWorker}</Link> : null}
        </div>

        <p className="muted" style={{ margin: '0 0 14px' }}>{c.liveNote}</p>
        {filtered ? <p className="muted" style={{ marginBottom: 12 }}>{c.filtered} · <Link href="/jobs">{c.showAll}</Link></p> : null}
        {isAdminRole(role) && assignmentFilter === 'missing_completion_date' ? <p className="muted" style={{ marginBottom: 12 }}>{c.missingFinish}</p> : null}
        {loadError ? <p className="auth-message auth-message-error">{loadError}</p> : null}
        {loading ? <p className="loading-state" role="status">{c.loading}</p> : null}
        {!loading && rows.length === 0 ? <LocalizedEmptyState emptyKey="jobs" /> : null}

        {!loading && rows.length > 0 ? (
          <div className="card jobs-table-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="jobs-operations-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr>
                    {[c.date, c.time, c.property, c.customer, c.assignedTo, c.status, c.actions].map((label) => (
                      <th key={label} style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((job) => {
                    const assignedName = job.assigned_to ? workerNames[job.assigned_to] : null;
                    const assignment = assignedName || job.assigned_email || c.unassigned;
                    return (
                      <tr
                        key={job.id}
                        tabIndex={0}
                        onClick={() => router.push(`/jobs/${job.id}`)}
                        onKeyDown={(event) => { if (event.key === 'Enter') router.push(`/jobs/${job.id}`); }}
                        style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                      >
                        <td style={{ padding: '14px', whiteSpace: 'nowrap', fontWeight: 600 }}>{formatDate(job, localeCode, c.unscheduled)}</td>
                        <td style={{ padding: '14px', whiteSpace: 'nowrap' }}>{formatTime(job, localeCode)}</td>
                        <td style={{ padding: '14px', minWidth: 230 }}>
                          <Link href={`/jobs/${job.id}`} onClick={(event) => event.stopPropagation()} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 700 }}>{job.title}</Link>
                          <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>{job.address || c.noAddress}</div>
                          {job.photo_count ? <div className="muted" style={{ marginTop: 3, fontSize: 12 }}>{job.photo_count} {job.photo_count === 1 ? c.photo : c.photos}</div> : null}
                        </td>
                        <td style={{ padding: '14px', minWidth: 150 }}>{job.customer_name || c.noCustomer}</td>
                        <td style={{ padding: '14px', minWidth: 160 }}>
                          <span style={{ fontWeight: !job.assigned_to && !job.assigned_email ? 700 : 500 }}>{assignment}</span>
                        </td>
                        <td style={{ padding: '14px', whiteSpace: 'nowrap' }}><StatusPill status={job.status} /></td>
                        <td style={{ padding: '14px', whiteSpace: 'nowrap' }} onClick={(event) => event.stopPropagation()}>
                          <div className="button-row" style={{ flexWrap: 'nowrap', gap: 8 }}>
                            {job.address ? <a href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`} className="btn" target="_blank" rel="noreferrer">{c.maps}</a> : null}
                            {managerView ? (
                              <button type="button" className="btn" disabled={duplicatingId === job.id} onClick={() => void bookAgain(job)}>
                                {duplicatingId === job.id ? c.creating : c.bookAgain}
                              </button>
                            ) : null}
                            {managerView ? (
                              <details>
                                <summary className="btn">{c.more}</summary>
                                <div style={{ position: 'absolute', right: 20, marginTop: 8, zIndex: 5 }}>
                                  <button type="button" className="btn btn-danger" disabled={removingId === job.id} onClick={() => void removeJob(job)}>
                                    {removingId === job.id ? c.removing : c.remove}
                                  </button>
                                </div>
                              </details>
                            ) : null}
                          </div>
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

export default function JobsPage() {
  return <Suspense><JobsList /></Suspense>;
}
