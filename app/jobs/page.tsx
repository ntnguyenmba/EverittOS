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

const copy = {
  en: {
    newJob: 'New job', all: 'All', today: 'Today', active: 'Active', finished: 'Finished', needsWorker: 'Needs worker',
    filtered: 'Filtered', showAll: 'Show all', missingFinish: 'Finished jobs missing a finish date.', loading: 'Loading…',
    unableLoad: 'Unable to load jobs.', removeConfirm: 'Remove job "{title}"?', unableRemove: 'Unable to remove job.',
    noCustomer: 'No customer', noAddress: 'No address', photo: 'photo', photos: 'photos', openJob: 'Open job', maps: 'Maps',
    more: 'More', removing: 'Removing…', remove: 'Remove', bookAgain: 'Book again', creating: 'Creating…'
  },
  es: {
    newJob: 'Nuevo trabajo', all: 'Todos', today: 'Hoy', active: 'Activos', finished: 'Finalizados', needsWorker: 'Necesita trabajador',
    filtered: 'Filtrado', showAll: 'Mostrar todos', missingFinish: 'Trabajos finalizados sin fecha de finalización.', loading: 'Cargando…',
    unableLoad: 'No se pudieron cargar los trabajos.', removeConfirm: '¿Eliminar el trabajo "{title}"?', unableRemove: 'No se pudo eliminar el trabajo.',
    noCustomer: 'Sin cliente', noAddress: 'Sin dirección', photo: 'foto', photos: 'fotos', openJob: 'Abrir trabajo', maps: 'Mapas',
    more: 'Más', removing: 'Eliminando…', remove: 'Eliminar', bookAgain: 'Reservar de nuevo', creating: 'Creando…'
  },
  vi: {
    newJob: 'Công việc mới', all: 'Tất cả', today: 'Hôm nay', active: 'Đang hoạt động', finished: 'Đã hoàn thành', needsWorker: 'Cần nhân sự',
    filtered: 'Đã lọc', showAll: 'Hiển thị tất cả', missingFinish: 'Công việc đã hoàn thành nhưng thiếu ngày hoàn tất.', loading: 'Đang tải…',
    unableLoad: 'Không thể tải công việc.', removeConfirm: 'Xóa công việc "{title}"?', unableRemove: 'Không thể xóa công việc.',
    noCustomer: 'Không có khách hàng', noAddress: 'Không có địa chỉ', photo: 'ảnh', photos: 'ảnh', openJob: 'Mở công việc', maps: 'Bản đồ',
    more: 'Thêm', removing: 'Đang xóa…', remove: 'Xóa', bookAgain: 'Đặt lại', creating: 'Đang tạo…'
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
  photo_count?: number;
};

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
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [removingId, setRemovingId] = useState('');
  const [duplicatingId, setDuplicatingId] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
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

      const res = await fetch(`/api/jobs?${params.toString()}`);
      const json = (await res.json()) as { jobs?: Job[]; error?: string };
      if (!res.ok) {
        const message = json.error || c.unableLoad;
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
  }, [router, customerFilter, statusFilter, periodFilter, assignmentFilter, assignedToFilter, createdFromFilter, appFeedback, c.unableLoad]);

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

  return (
    <AppShell plan={plan} role={role}>
      <div className="jobs-list-page">
        <PageHeader
          title={t('nav.jobs')}
          action={<Link className="btn btn-primary" href="/jobs/new">{c.newJob}</Link>}
        />

        <div className="button-row" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Link href="/jobs" className="btn">{c.all}</Link>
          <Link href="/jobs?period=today" className="btn">{c.today}</Link>
          <Link href="/jobs?status=active" className="btn">{c.active}</Link>
          <Link href="/jobs?status=completed" className="btn">{c.finished}</Link>
          {isManagerRole(role) ? <Link href="/jobs?filter=unassigned" className="btn">{c.needsWorker}</Link> : null}
        </div>

        {filtered ? <p className="muted" style={{ marginBottom: 12 }}>{c.filtered} · <Link href="/jobs">{c.showAll}</Link></p> : null}
        {isAdminRole(role) && assignmentFilter === 'missing_completion_date' ? <p className="muted" style={{ marginBottom: 12 }}>{c.missingFinish}</p> : null}
        {loadError ? <p className="auth-message auth-message-error">{loadError}</p> : null}
        {loading ? <p className="loading-state" role="status">{c.loading}</p> : null}
        {!loading && jobs.length === 0 ? <LocalizedEmptyState emptyKey="jobs" /> : null}

        {!loading && jobs.length > 0 ? (
          <div style={{ display: 'grid', gap: 14 }}>
            {jobs.map((job) => (
              <article key={job.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ marginBottom: 6 }}><Link href={`/jobs/${job.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{job.title}</Link></h3>
                    <p style={{ margin: 0 }}>{job.customer_name || c.noCustomer}</p>
                    <p className="muted" style={{ marginTop: 4 }}>{job.address || c.noAddress}</p>
                  </div>
                  <StatusPill status={job.status} />
                </div>

                {job.photo_count ? <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>{job.photo_count} {job.photo_count === 1 ? c.photo : c.photos}</p> : null}

                <div className="button-row" style={{ marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Link href={`/jobs/${job.id}`} className="btn btn-primary" aria-label={`${c.openJob} ${job.title}`}>{c.openJob}</Link>
                  {job.address ? <a href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`} className="btn" target="_blank" rel="noreferrer">{c.maps}</a> : null}
                  {isManagerRole(role) ? (
                    <button type="button" className="btn" disabled={duplicatingId === job.id} onClick={() => void bookAgain(job)}>
                      {duplicatingId === job.id ? c.creating : c.bookAgain}
                    </button>
                  ) : null}
                  {isManagerRole(role) ? (
                    <details style={{ marginLeft: 'auto' }}>
                      <summary className="btn">{c.more}</summary>
                      <div style={{ marginTop: 8 }}>
                        <button type="button" className="btn btn-danger" disabled={removingId === job.id} onClick={() => void removeJob(job)}>
                          {removingId === job.id ? c.removing : c.remove}
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
  return <Suspense><JobsList /></Suspense>;
}
