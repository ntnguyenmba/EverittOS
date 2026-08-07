'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { ExportMenu } from '@/components/export-menu';
import { useTranslation } from '@/components/locale-provider';
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
  customer_name: string | null;
  address: string | null;
  revenue_amount: number | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string | null;
};

type TimeRange = 'today' | 'week' | 'month' | 'year' | 'all';

const copy = {
  en: {
    today: 'Today', week: 'This week', month: 'This month', year: 'This year', all: 'All', timePeriod: 'Time period',
    upcoming: 'Upcoming jobs', completed: 'Completed jobs', current: 'Upcoming', past: 'Completed',
    noUpcoming: 'No upcoming jobs.', noCompleted: 'No completed jobs.',
    serviceAmount: 'Price', status: 'Status', dateNotSet: 'Date not set',
    statuses: { scheduled: 'scheduled', completed: 'completed', complete: 'completed', finished: 'completed', done: 'completed', cancelled: 'cancelled', canceled: 'cancelled' }
  },
  es: {
    today: 'Hoy', week: 'Esta semana', month: 'Este mes', year: 'Este año', all: 'Todo', timePeriod: 'Período',
    upcoming: 'Próximos trabajos', completed: 'Trabajos terminados', current: 'Próximos', past: 'Terminados',
    noUpcoming: 'No hay trabajos próximos.', noCompleted: 'No hay trabajos terminados.',
    serviceAmount: 'Precio', status: 'Estado', dateNotSet: 'Fecha no definida',
    statuses: { scheduled: 'programado', completed: 'terminado', complete: 'terminado', finished: 'terminado', done: 'terminado', cancelled: 'cancelado', canceled: 'cancelado' }
  },
  vi: {
    today: 'Hôm nay', week: 'Tuần này', month: 'Tháng này', year: 'Năm nay', all: 'Tất cả', timePeriod: 'Khoảng thời gian',
    upcoming: 'Công việc sắp tới', completed: 'Công việc đã xong', current: 'Sắp tới', past: 'Đã xong',
    noUpcoming: 'Không có công việc sắp tới.', noCompleted: 'Không có công việc đã xong.',
    serviceAmount: 'Giá', status: 'Trạng thái', dateNotSet: 'Chưa có ngày',
    statuses: { scheduled: 'đã lên lịch', completed: 'đã xong', complete: 'đã xong', finished: 'đã xong', done: 'đã xong', cancelled: 'đã hủy', canceled: 'đã hủy' }
  }
} as const;

function cityState(address: string | null) {
  if (!address) return '';
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length >= 2 ? parts.slice(-2).join(', ') : address;
}

function operationalDate(job: ClientJob) {
  return (
    wallClockFromTimestamp(job.scheduled_start)?.date ||
    job.start_date?.slice(0, 10) ||
    job.due_date?.slice(0, 10) ||
    job.created_at?.slice(0, 10) ||
    ''
  );
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
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(locale, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
}

function jobTime(job: ClientJob, locale: string) {
  const start = wallClockFromTimestamp(job.scheduled_start);
  const end = wallClockFromTimestamp(job.scheduled_end);
  if (!start?.time) return '';
  const format = (time: string) => new Date(`2000-01-01T${time}:00`).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  return end?.time ? `${format(start.time)} – ${format(end.time)}` : format(start.time);
}

function formatMoney(value: number | null, locale: string) {
  if (value == null || !Number.isFinite(Number(value))) return '';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(Number(value));
}

function rangeBounds(range: TimeRange) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  if (range === 'today') end.setDate(end.getDate() + 1);
  if (range === 'week') end.setDate(end.getDate() + 7);
  if (range === 'month') end.setMonth(end.getMonth() + 1);
  if (range === 'year') end.setFullYear(end.getFullYear() + 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default function ClientPortalJobsPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const c = copy[locale] || copy.en;
  const exportCopy = getExportCopy(locale);
  const localeCode = locale === 'vi' ? 'vi-VN' : locale === 'es' ? 'es-US' : 'en-US';
  const [jobs, setJobs] = useState<ClientJob[]>([]);
  const [range, setRange] = useState<TimeRange>('month');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push(`/login?next=${encodeURIComponent(clientPortalJobsPath())}`);
        return;
      }

      try { await fetch('/api/portal/client/repair', { method: 'POST' }); } catch {}

      const { data: profileRow } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (!isClientRole(normalizeRole(profileRow?.role))) {
        router.replace(CLIENT_PORTAL_HOME);
        return;
      }

      const { data: access } = await supabase.from('job_client_access').select('job_id').eq('client_user_id', user.id);
      const jobIds = ((access || []) as Array<{ job_id: string }>).map((row) => String(row.job_id)).filter(Boolean);
      if (jobIds.length === 0) {
        setMessage(t('portal.client.noSharedMessage'));
        setLoading(false);
        return;
      }

      const { data: jobRows } = await supabase
        .from('jobs')
        .select('id, title, status, customer_name, address, revenue_amount, scheduled_start, scheduled_end, start_date, due_date, completed_at, created_at')
        .in('id', jobIds);
      setJobs((jobRows || []) as ClientJob[]);
      setLoading(false);
    }
    void load();
  }, [router, t]);

  const visibleJobs = useMemo(() => {
    if (range === 'all') return jobs;
    const { start, end } = rangeBounds(range);
    return jobs.filter((job) => {
      const date = operationalDate(job);
      return date && date >= start && date < end;
    });
  }, [jobs, range]);

  const groupedJobs = useMemo(() => {
    const today = localToday();
    const current: ClientJob[] = [];
    const history: ClientJob[] = [];
    for (const job of visibleJobs) {
      const date = operationalDate(job);
      if (isFinished(job) || isCancelled(job) || (date && date < today)) history.push(job);
      else current.push(job);
    }
    current.sort((a, b) => operationalDate(a).localeCompare(operationalDate(b)));
    history.sort((a, b) => operationalDate(b).localeCompare(operationalDate(a)));
    return { current, history };
  }, [visibleJobs]);

  function statusLabel(job: ClientJob) {
    const key = normalizedStatus(job) as keyof typeof c.statuses;
    return c.statuses[key] || normalizedStatus(job).replace(/_/g, ' ');
  }

  function renderJobCard(job: ClientJob) {
    const date = jobDate(job, localeCode);
    const time = jobTime(job, localeCode);
    const location = cityState(job.address);
    const amount = formatMoney(job.revenue_amount, localeCode);
    return (
      <article key={job.id} className="client-job-card simplified-job-card" aria-label={job.title}>
        <div className="client-job-card-main">
          <h3>{job.title}</h3>
          <p className="client-job-secondary">{[date || c.dateNotSet, time].filter(Boolean).join(' · ')}</p>
          {location ? <p className="client-job-secondary">{location}</p> : null}
        </div>
        <div className="client-job-card-meta">
          {job.status ? <span className="status-badge">{statusLabel(job)}</span> : null}
          {amount ? <strong>{c.serviceAmount}: {amount}</strong> : null}
        </div>
      </article>
    );
  }

  function renderSection(id: string, title: string, rows: ClientJob[], emptyText: string, open = false) {
    return (
      <details id={id} className="card portal-dashboard-section" open={open}>
        <summary><h2>{title}</h2><span>{rows.length}</span></summary>
        {rows.length === 0 ? <p className="muted">{emptyText}</p> : <div className="client-job-card-list">{rows.map(renderJobCard)}</div>}
      </details>
    );
  }

  if (loading) return <AuthenticatedSection role="client"><div className="card" role="status">{t('portal.client.loadingSharedJobs')}</div></AuthenticatedSection>;

  return (
    <AuthenticatedSection role="client" className="client-portal-jobs role-dashboard-minimal">
      <div className="role-dashboard-topbar">
        <div className="role-period-filter" aria-label={c.timePeriod}>
          {(['today', 'week', 'month', 'year', 'all'] as TimeRange[]).map((item) => (
            <button key={item} type="button" className={range === item ? 'is-active' : ''} onClick={() => setRange(item)}>{c[item]}</button>
          ))}
        </div>
        <ExportMenu
          endpoint="/api/exports/portal/client/jobs"
          locale={locale}
          labels={{ export: exportCopy.downloadMyJobs, csv: exportCopy.downloadMyJobsCsv, pdf: exportCopy.downloadMyJobsPdf }}
          disabled={loading || Boolean(message)}
          onError={(err) => setExportError(err || exportCopy.exportFailed)}
          onSuccess={() => setExportError('')}
        />
      </div>

      <PortalClientNav active="appointments" overviewHref={CLIENT_PORTAL_HOME} appointmentsHref={clientPortalJobsPath()} accountHref={CLIENT_SETTINGS_PATH} />
      {exportError ? <p className="auth-message auth-message-error">{exportError}</p> : null}

      {message ? (
        <div className="card" role="status"><h3>{t('portal.client.noSharedTitle')}</h3><p>{message}</p></div>
      ) : (
        <>
          <div className="role-summary-grid">
            <div className="role-summary-card"><strong>{groupedJobs.current.length}</strong><span>{c.upcoming}</span></div>
            <div className="role-summary-card"><strong>{groupedJobs.history.length}</strong><span>{c.completed}</span></div>
          </div>
          {renderSection('current-jobs', c.current, groupedJobs.current, c.noUpcoming, true)}
          {renderSection('history', c.past, groupedJobs.history, c.noCompleted)}
        </>
      )}
    </AuthenticatedSection>
  );
}
