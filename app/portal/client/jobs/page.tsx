'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClientSendMessage } from '@/components/client-send-message';
import { ExportMenu } from '@/components/export-menu';
import { useTranslation } from '@/components/locale-provider';
import { PhotoGallery } from '@/components/photo-gallery';
import { PortalClientNav } from '@/components/portal/portal-client-nav';
import { CLIENT_SETTINGS_PATH } from '@/lib/client-portal';
import { getExportCopy } from '@/lib/i18n/export-copy';
import { clientPortalJobsPath, CLIENT_PORTAL_HOME } from '@/lib/portal-access';
import { isClientRole, normalizeRole } from '@/lib/roles';
import { localToday, wallClockFromTimestamp } from '@/lib/schedule-times';
import { supabase } from '@/lib/supabase';

type ClientJob = {
  id: string;
  title: string;
  status: string | null;
  customerName: string | null;
  address: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string | null;
  jobTotal: number | null;
  paid: number;
  balanceDue: number | null;
};

const copy = {
  en: {
    nextVisit: 'Next visit', upcoming: 'Upcoming visits', completed: 'Past visits', noUpcoming: 'No appointments yet.', noCompleted: 'No completed appointments yet.', balanceDue: 'Balance due', dateNotSet: 'Schedule pending', viewVisit: 'View visit', photos: 'Visit photos', more: 'More', exportHistory: 'Export visit history',
    statuses: { scheduled: 'scheduled', completed: 'completed', complete: 'completed', finished: 'completed', done: 'completed', cancelled: 'cancelled', canceled: 'cancelled' }
  },
  es: {
    nextVisit: 'Próxima visita', upcoming: 'Próximas visitas', completed: 'Visitas anteriores', noUpcoming: 'Aún no hay citas.', noCompleted: 'Aún no hay citas terminadas.', balanceDue: 'Saldo pendiente', dateNotSet: 'Horario pendiente', viewVisit: 'Ver visita', photos: 'Fotos de la visita', more: 'Más', exportHistory: 'Exportar historial de visitas',
    statuses: { scheduled: 'programado', completed: 'terminado', complete: 'terminado', finished: 'terminado', done: 'terminado', cancelled: 'cancelado', canceled: 'cancelado' }
  },
  vi: {
    nextVisit: 'Lịch hẹn tiếp theo', upcoming: 'Lịch hẹn sắp tới', completed: 'Lịch hẹn trước', noUpcoming: 'Chưa có lịch hẹn.', noCompleted: 'Chưa có lịch hẹn đã hoàn thành.', balanceDue: 'Số còn lại', dateNotSet: 'Lịch đang chờ', viewVisit: 'Xem lịch hẹn', photos: 'Ảnh lịch hẹn', more: 'Thêm', exportHistory: 'Xuất lịch sử lịch hẹn',
    statuses: { scheduled: 'đã lên lịch', completed: 'đã xong', complete: 'đã xong', finished: 'đã xong', done: 'đã xong', cancelled: 'đã hủy', canceled: 'đã hủy' }
  }
} as const;

function cityState(address: string | null) {
  if (!address) return '';
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length >= 2 ? parts.slice(-2).join(', ') : address;
}

function operationalDate(job: ClientJob) {
  return wallClockFromTimestamp(job.scheduledStart)?.date || job.startDate?.slice(0, 10) || job.dueDate?.slice(0, 10) || job.createdAt?.slice(0, 10) || '';
}

function normalizedStatus(job: ClientJob) {
  return String(job.status || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function isFinished(job: ClientJob) {
  return ['completed', 'complete', 'finished', 'done'].includes(normalizedStatus(job));
}

function isCancelled(job: ClientJob) {
  return ['cancelled', 'canceled'].includes(normalizedStatus(job));
}

function jobDate(job: ClientJob, locale: string) {
  const value = operationalDate(job);
  if (!value) return '';
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });
}

function jobTime(job: ClientJob, locale: string) {
  const start = wallClockFromTimestamp(job.scheduledStart);
  const end = wallClockFromTimestamp(job.scheduledEnd);
  if (!start?.time) return '';
  const format = (time: string) => new Date(`2000-01-01T${time}:00`).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  return end?.time ? `${format(start.time)} – ${format(end.time)}` : format(start.time);
}

function formatMoney(value: number | null, locale: string) {
  if (value == null || !Number.isFinite(Number(value))) return '';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(Number(value));
}

export default function ClientPortalJobsPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const c = copy[locale] || copy.en;
  const exportCopy = getExportCopy(locale);
  const localeCode = locale === 'vi' ? 'vi-VN' : locale === 'es' ? 'es-US' : 'en-US';
  const [jobs, setJobs] = useState<ClientJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [empty, setEmpty] = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    async function load() {
      setEmpty(false);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push(`/login?next=${encodeURIComponent(clientPortalJobsPath())}`); return; }
      const { data: profileRow } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (!isClientRole(normalizeRole(profileRow?.role))) { router.replace(CLIENT_PORTAL_HOME); return; }
      const response = await fetch('/api/portal/client/jobs', { cache: 'no-store' });
      if (response.status === 401) { router.push(`/login?next=${encodeURIComponent(clientPortalJobsPath())}`); return; }
      const payload = (await response.json().catch(() => ({}))) as { jobs?: ClientJob[]; error?: string };
      if (!response.ok) { setMessage(payload.error || t('portal.client.jobLoadError')); setLoading(false); return; }
      const rows = payload.jobs || [];
      setJobs(rows); setMessage(''); setEmpty(rows.length === 0); setLoading(false);
    }
    void load();
  }, [router, t]);

  const nextVisit = useMemo(() => {
    const today = localToday();
    return jobs.filter((job) => {
      const date = operationalDate(job);
      return !isFinished(job) && !isCancelled(job) && Boolean(date && date >= today);
    }).sort((a, b) => operationalDate(a).localeCompare(operationalDate(b)))[0] || null;
  }, [jobs]);

  const upcomingVisits = useMemo(() => {
    const today = localToday();
    return jobs.filter((job) => {
      const date = operationalDate(job);
      return job.id !== nextVisit?.id && !isFinished(job) && !isCancelled(job) && Boolean(date && date >= today);
    }).sort((a, b) => operationalDate(a).localeCompare(operationalDate(b)));
  }, [jobs, nextVisit]);

  const pastVisits = useMemo(() => {
    const today = localToday();
    return jobs.filter((job) => {
      const date = operationalDate(job);
      return isFinished(job) || isCancelled(job) || Boolean(date && date < today);
    }).sort((a, b) => operationalDate(b).localeCompare(operationalDate(a)));
  }, [jobs]);

  function statusLabel(job: ClientJob) {
    const key = normalizedStatus(job) as keyof typeof c.statuses;
    return c.statuses[key] || normalizedStatus(job).replace(/_/g, ' ');
  }

  function renderVisit(job: ClientJob) {
    const date = jobDate(job, localeCode);
    const time = jobTime(job, localeCode);
    const location = cityState(job.address);
    const balance = Number(job.balanceDue || 0);
    return (
      <Link key={job.id} href={clientPortalJobsPath(job.id)} className="client-job-card simplified-job-card" aria-label={job.title}>
        <div className="client-job-card-main"><h3>{job.title}</h3>{date || time ? <p className="client-job-secondary">{[date, time].filter(Boolean).join(' · ')}</p> : null}{location ? <p className="client-job-secondary">{location}</p> : null}</div>
        <div className="client-job-card-meta">{job.status ? <span className={`status-badge portal-status-${normalizedStatus(job)}`}>{statusLabel(job)}</span> : null}{balance > 0 ? <strong className="portal-finance-amount">{formatMoney(balance, localeCode)}</strong> : null}</div>
      </Link>
    );
  }

  if (loading) return <div className="client-portal-jobs"><div className="card" role="status">{t('portal.client.loadingSharedJobs')}</div></div>;

  return (
    <div className="client-portal-jobs role-dashboard-minimal">
      <PortalClientNav active="appointments" overviewHref={CLIENT_PORTAL_HOME} appointmentsHref={clientPortalJobsPath()} accountHref={CLIENT_SETTINGS_PATH} />
      {exportError ? <p className="auth-message auth-message-error">{exportError}</p> : null}
      {empty ? <div className="card client-empty-state" role="status"><p>{c.noUpcoming}</p></div> : message ? <div className="card" role="alert"><p>{message}</p></div> : <>
        {nextVisit ? <>
          <section className="client-next-visit client-next-visit-paper">
            <div className="client-next-visit-copy">
              <p className="eyebrow">{c.nextVisit}</p><h1>{nextVisit.title}</h1>
              <p className="client-next-visit-time">{[jobDate(nextVisit, localeCode), jobTime(nextVisit, localeCode)].filter(Boolean).join(' · ') || c.dateNotSet}</p>
              {nextVisit.address ? <p className="muted">{nextVisit.address}</p> : null}
              {Number(nextVisit.balanceDue || 0) > 0 ? <p className="client-next-balance"><span>{c.balanceDue}</span><strong>{formatMoney(nextVisit.balanceDue, localeCode)}</strong></p> : null}
              <Link className="btn btn-primary" href={clientPortalJobsPath(nextVisit.id)}>{c.viewVisit}</Link>
            </div>
            <div className="client-next-visit-photos"><h2>{c.photos}</h2><PhotoGallery jobId={nextVisit.id} refreshKey={0} canView customerOnly /></div>
          </section>
          <ClientSendMessage jobId={nextVisit.id} />
        </> : null}
        {upcomingVisits.length > 0 ? <section className="client-upcoming-simple" aria-labelledby="client-upcoming-title"><div className="client-section-heading"><h2 id="client-upcoming-title">{c.upcoming}</h2><span>{upcomingVisits.length}</span></div><div className="client-job-card-list">{upcomingVisits.map(renderVisit)}</div></section> : null}
        <details className="card client-more"><summary><strong>{c.more}</strong></summary><div className="client-more-body"><section aria-labelledby="client-history-title"><div className="client-section-heading"><h2 id="client-history-title">{c.completed}</h2><span>{pastVisits.length}</span></div>{pastVisits.length === 0 ? <p className="muted">{c.noCompleted}</p> : <div className="client-job-card-list">{pastVisits.map(renderVisit)}</div>}</section><div className="client-export-row"><span>{c.exportHistory}</span><ExportMenu endpoint="/api/exports/portal/client/jobs" locale={locale} labels={{ export: exportCopy.downloadMyJobs, csv: exportCopy.downloadMyJobsCsv, pdf: exportCopy.downloadMyJobsPdf }} disabled={loading || Boolean(message) || empty} onError={(error) => setExportError(error || exportCopy.exportFailed)} onSuccess={() => setExportError('')} /></div></div></details>
      </>}
    </div>
  );
}
