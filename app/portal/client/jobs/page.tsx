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
import { wallClockFromTimestamp } from '@/lib/schedule-times';
import { supabase } from '@/lib/supabase';

type ClientJob = {
  id: string;
  title: string;
  status: string | null;
  customer_name: string | null;
  address: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string | null;
};

const INITIAL_VISIBLE_JOBS = 6;

function cityState(address: string | null) {
  if (!address) return '';
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return parts.slice(-2).join(', ');
  return address;
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

function isFinished(job: ClientJob) {
  return ['completed', 'complete', 'finished', 'done'].includes(String(job.status || '').toLowerCase());
}

function isCancelled(job: ClientJob) {
  return ['cancelled', 'canceled'].includes(String(job.status || '').toLowerCase());
}

function sortClientJobs(rows: ClientJob[]) {
  return rows.slice().sort((a, b) => {
    const aGroup = isCancelled(a) ? 2 : isFinished(a) ? 1 : 0;
    const bGroup = isCancelled(b) ? 2 : isFinished(b) ? 1 : 0;
    if (aGroup !== bGroup) return aGroup - bGroup;

    if (aGroup === 0) return operationalDate(a).localeCompare(operationalDate(b));

    const aDate = (a.completed_at || a.scheduled_start || a.start_date || a.due_date || a.created_at || '').slice(0, 19);
    const bDate = (b.completed_at || b.scheduled_start || b.start_date || b.due_date || b.created_at || '').slice(0, 19);
    return bDate.localeCompare(aDate);
  });
}

function jobDate(job: ClientJob, locale: string) {
  const value = operationalDate(job);
  if (!value) return '';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return parsed.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function jobTime(job: ClientJob, locale: string) {
  const start = wallClockFromTimestamp(job.scheduled_start);
  const end = wallClockFromTimestamp(job.scheduled_end);
  if (!start?.time) return '';
  const format = (time: string) => {
    const parsed = new Date(`2000-01-01T${time}:00`);
    return parsed.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  };
  return end?.time ? `${format(start.time)} – ${format(end.time)}` : format(start.time);
}

export default function ClientPortalJobsPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const exportCopy = getExportCopy(locale);
  const localeCode = locale === 'vi' ? 'vi-VN' : locale === 'es' ? 'es-US' : 'en-US';
  const [jobs, setJobs] = useState<ClientJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [exportError, setExportError] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push(`/login?next=${encodeURIComponent(clientPortalJobsPath())}`);
        return;
      }

      try {
        await fetch('/api/portal/client/repair', { method: 'POST' });
      } catch {
        // Continue with current access rows.
      }

      const { data: profileRow } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (!isClientRole(normalizeRole(profileRow?.role))) {
        router.replace(CLIENT_PORTAL_HOME);
        return;
      }

      const { data: access } = await supabase.from('job_client_access').select('job_id').eq('client_user_id', user.id);
      const jobIds = ((access || []) as Array<{ job_id: string }>).map((row) => String(row.job_id)).filter(Boolean);

      if (jobIds.length === 0) {
        setJobs([]);
        setMessage(t('portal.client.noSharedMessage'));
        setLoading(false);
        return;
      }

      const { data: jobRows } = await supabase
        .from('jobs')
        .select('id, title, status, customer_name, address, scheduled_start, scheduled_end, start_date, due_date, completed_at, created_at')
        .in('id', jobIds);

      setJobs(sortClientJobs((jobRows || []) as ClientJob[]));
      setLoading(false);
    }

    void load();
  }, [router, t]);

  const visibleJobs = useMemo(() => (showAll ? jobs : jobs.slice(0, INITIAL_VISIBLE_JOBS)), [jobs, showAll]);

  if (loading) {
    return (
      <AuthenticatedSection role="client">
        <div className="card" role="status" aria-live="polite">
          {t('portal.client.loadingSharedJobs')}
        </div>
      </AuthenticatedSection>
    );
  }

  return (
    <AuthenticatedSection role="client" className="client-portal-jobs">
      <header style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <p className="eyebrow">{t('portal.client.portal')}</p>
            <h2 style={{ marginBottom: 6 }}>{t('portal.client.sharedJobsTitle')}</h2>
            <p className="muted" style={{ margin: 0 }}>{t('portal.client.sharedJobsDescription')}</p>
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
      </header>

      <PortalClientNav
        active="appointments"
        overviewHref={CLIENT_PORTAL_HOME}
        appointmentsHref={clientPortalJobsPath()}
        accountHref={CLIENT_SETTINGS_PATH}
      />

      {exportError ? <p className="auth-message auth-message-error">{exportError}</p> : null}

      {message ? (
        <div className="card" role="status">
          <h3>{t('portal.client.noSharedTitle')}</h3>
          <p>{message}</p>
        </div>
      ) : (
        <>
          <div className="client-job-card-list">
            {visibleJobs.map((job) => {
              const date = jobDate(job, localeCode);
              const time = jobTime(job, localeCode);
              const location = cityState(job.address);
              return (
                <article key={job.id} className="client-job-card" aria-label={job.title}>
                  <div className="client-job-card-main">
                    <p className="eyebrow">{t('portal.contractor.job')}</p>
                    <h3>{job.title}</h3>
                    {job.customer_name ? <p className="client-job-secondary">{job.customer_name}</p> : null}
                    {location ? <p className="client-job-secondary">{location}</p> : null}
                  </div>
                  {(date || time) ? (
                    <div className="client-job-schedule">
                      {date ? <strong>{date}</strong> : null}
                      {time ? <span>{time}</span> : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
          {jobs.length > INITIAL_VISIBLE_JOBS ? (
            <button type="button" className="btn" style={{ marginTop: 16 }} onClick={() => setShowAll((current) => !current)} aria-expanded={showAll}>
              {showAll ? 'Show fewer jobs' : `Show all ${jobs.length} jobs`}
            </button>
          ) : null}
        </>
      )}
    </AuthenticatedSection>
  );
}
