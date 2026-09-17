'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { useTranslation } from '@/components/locale-provider';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { filterDemoSeedJobs } from '@/lib/demo-seed-filter';
import { fetchOrganizationContext } from '@/lib/organization';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
import { fetchPhotoCountsByJobIds } from '@/lib/job-photo-counts';
import { scopeJobsForWorkspace } from '@/lib/jobs-query';
import { supabase } from '@/lib/supabase';

type Job = {
  id: string;
  title: string;
  customer_name: string | null;
  address: string | null;
  status: string | null;
  photo_count?: number;
};

type PhotoFilter = 'needs' | 'has' | 'all';

const copy = {
  en: {
    title: 'Photos', subtitle: 'Review job photos and see which jobs still need documentation.',
    noPhotosYet: 'No photos yet', addPhotos: 'Add photos', viewPhotos: 'View photos',
    chooseJob: 'Choose job', needsPhotos: 'Needs photos', hasPhotos: 'Has photos', allJobs: 'All jobs',
    loading: 'Loading…', allHavePhotos: 'All jobs have photos', nothingNeedsAttention: 'Nothing needs attention.',
    chooseJobHelp: 'Choose a job to add before and after photos.', viewJobs: 'View jobs',
    noCustomer: 'No customer', noPhotos: 'No photos', photo: 'photo', photos: 'photos', maps: 'Maps', job: 'Job'
  },
  es: {
    title: 'Fotos', subtitle: 'Revisa las fotos y detecta qué trabajos aún necesitan documentación.',
    noPhotosYet: 'Aún no hay fotos', addPhotos: 'Agregar fotos', viewPhotos: 'Ver fotos',
    chooseJob: 'Elegir trabajo', needsPhotos: 'Necesita fotos', hasPhotos: 'Tiene fotos', allJobs: 'Todos los trabajos',
    loading: 'Cargando…', allHavePhotos: 'Todos los trabajos tienen fotos', nothingNeedsAttention: 'Nada necesita atención.',
    chooseJobHelp: 'Elija un trabajo para agregar fotos de antes y después.', viewJobs: 'Ver trabajos',
    noCustomer: 'Sin cliente', noPhotos: 'Sin fotos', photo: 'foto', photos: 'fotos', maps: 'Mapas', job: 'Trabajo'
  },
  vi: {
    title: 'Ảnh', subtitle: 'Xem ảnh công việc và biết công việc nào vẫn cần ghi nhận.',
    noPhotosYet: 'Chưa có ảnh', addPhotos: 'Thêm ảnh', viewPhotos: 'Xem ảnh',
    chooseJob: 'Chọn công việc', needsPhotos: 'Cần ảnh', hasPhotos: 'Có ảnh', allJobs: 'Tất cả công việc',
    loading: 'Đang tải…', allHavePhotos: 'Tất cả công việc đều có ảnh', nothingNeedsAttention: 'Không có mục nào cần xử lý.',
    chooseJobHelp: 'Chọn một công việc để thêm ảnh trước và sau.', viewJobs: 'Xem công việc',
    noCustomer: 'Chưa có khách hàng', noPhotos: 'Chưa có ảnh', photo: 'ảnh', photos: 'ảnh', maps: 'Bản đồ', job: 'Công việc'
  }
} as const;

export default function PhotosPage() {
  const router = useRouter();
  const { locale } = useTranslation();
  const c = copy[locale];
  const [jobs, setJobs] = useState<Job[]>([]);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PhotoFilter>('needs');

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login?next=/photos');
        return;
      }

      const [{ data: profile }, org] = await Promise.all([
        supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle(),
        fetchOrganizationContext(user.id)
      ]);
      const workspaceRole = normalizeRole(org?.role || profile?.role);
      setPlan(normalizePlan(profile?.plan));
      setRole(workspaceRole);

      const query = scopeJobsForWorkspace(
        supabase
          .from('jobs')
          .select('id, title, customer_name, address, status')
          .order('created_at', { ascending: false }),
        user.id,
        org?.organizationId,
        workspaceRole
      );

      const [{ data }, orgIsDemo] = await Promise.all([
        query,
        fetchOrganizationIsDemo(supabase, org?.organizationId)
      ]);

      const rows = filterDemoSeedJobs((data || []) as Job[], orgIsDemo);
      const photoCounts = await fetchPhotoCountsByJobIds(rows.map((job) => job.id));
      setJobs(rows.map((job) => ({ ...job, photo_count: photoCounts[job.id] || 0 })));
      setLoading(false);
    }

    void load();
  }, [router]);

  const jobsNeedingPhotos = useMemo(() => jobs.filter((job) => (job.photo_count || 0) === 0), [jobs]);
  const jobsWithPhotos = useMemo(() => jobs.filter((job) => (job.photo_count || 0) > 0), [jobs]);
  const visibleJobs = filter === 'needs' ? jobsNeedingPhotos : filter === 'has' ? jobsWithPhotos : jobs;

  return (
    <AppShell plan={plan} role={role}>
      <PageHeader
        title={c.title}
        subtitle={c.subtitle}
        action={
          <Link className="btn btn-primary" href="/jobs">
            {c.chooseJob}
          </Link>
        }
      />

      <div className="button-row" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
        <button type="button" className={`btn ${filter === 'needs' ? 'btn-primary' : ''}`} onClick={() => setFilter('needs')}>
          {c.needsPhotos} ({jobsNeedingPhotos.length})
        </button>
        <button type="button" className={`btn ${filter === 'has' ? 'btn-primary' : ''}`} onClick={() => setFilter('has')}>
          {c.hasPhotos} ({jobsWithPhotos.length})
        </button>
        <button type="button" className={`btn ${filter === 'all' ? 'btn-primary' : ''}`} onClick={() => setFilter('all')}>
          {c.allJobs}
        </button>
      </div>

      {loading ? <div className="card"><p className="loading-state">{c.loading}</p></div> : null}

      {!loading && visibleJobs.length === 0 ? (
        <div className="card empty-action-card">
          <h3>{filter === 'needs' ? c.allHavePhotos : c.noPhotosYet}</h3>
          <p className="muted">
            {filter === 'needs' ? c.nothingNeedsAttention : c.chooseJobHelp}
          </p>
          <Link className="btn btn-primary" href="/jobs">{c.viewJobs}</Link>
        </div>
      ) : null}

      {!loading && visibleJobs.length > 0 ? (
        <div style={{ display: 'grid', gap: 14 }}>
          {visibleJobs.map((job) => {
            const hasPhotos = (job.photo_count || 0) > 0;
            return (
              <article key={job.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ marginBottom: 6 }}>{job.title}</h3>
                    <p style={{ marginBottom: 4 }}>{job.customer_name || c.noCustomer}</p>
                    {job.address ? <p className="muted" style={{ marginBottom: 0 }}>{job.address}</p> : null}
                  </div>
                  <StatusPill status={job.status} />
                </div>

                <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
                  {hasPhotos ? `${job.photo_count} ${job.photo_count === 1 ? c.photo : c.photos}` : c.noPhotos}
                </p>

                <div className="button-row" style={{ marginTop: 14, flexWrap: 'wrap' }}>
                  <Link className="btn btn-primary" href={`/jobs/${job.id}#before-after-photos`}>
                    {hasPhotos ? c.viewPhotos : c.addPhotos}
                  </Link>
                  {job.address ? (
                    <a className="btn" href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer">
                      {c.maps}
                    </a>
                  ) : null}
                  <Link className="btn" href={`/jobs/${job.id}`}>{c.job}</Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </AppShell>
  );
}
