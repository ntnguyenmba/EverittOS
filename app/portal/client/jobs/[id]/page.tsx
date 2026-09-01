'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ClientSendMessage } from '@/components/client-send-message';
import { PhotoGallery } from '@/components/photo-gallery';
import { useTranslation } from '@/components/locale-provider';
import { PortalClientNav } from '@/components/portal/portal-client-nav';
import { CLIENT_SETTINGS_PATH } from '@/lib/client-portal';
import { clientPortalJobsPath, CLIENT_PORTAL_HOME } from '@/lib/portal-access';
import { translatePortalJobStatus, translatePortalPaymentStatus } from '@/lib/portal-status-i18n';
import { supabase } from '@/lib/supabase';

type ClientJob = { id: string; title: string; status: string | null; customer_notes: string | null; due_date: string | null };
type ClientReport = { id: string; title: string; job_id: string; share_token: string | null; share_revoked_at: string | null };
type ClientInvoice = { id: string; job_id: string | null; amount: number | null; amount_paid: number | null; status: string | null; due_date: string | null };
type ClientCharges = { jobTotal: number | null; paid: number; balanceDue: number | null };
type SharedJobResponse = { job?: ClientJob; reports?: ClientReport[]; invoices?: ClientInvoice[]; charges?: ClientCharges; canViewPhotos?: boolean; error?: string };

export default function ClientPortalJobDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { t, locale } = useTranslation();
  const jobId = String(params?.id || '');
  const [job, setJob] = useState<ClientJob | null>(null);
  const [reports, setReports] = useState<ClientReport[]>([]);
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [charges, setCharges] = useState<ClientCharges | null>(null);
  const [canViewPhotos, setCanViewPhotos] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const localeCode = locale === 'vi' ? 'vi-VN' : locale === 'es' ? 'es-US' : 'en-US';
  const sharedReports = useMemo(() => reports.filter((report) => report.share_token && !report.share_revoked_at), [reports]);

  useEffect(() => {
    async function load() {
      if (!jobId) { router.replace(clientPortalJobsPath()); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push(`/login?next=${encodeURIComponent(clientPortalJobsPath(jobId))}`); return; }
      try {
        const response = await fetch(`/api/portal/client/jobs/${encodeURIComponent(jobId)}`, { method: 'GET', cache: 'no-store' });
        const payload = (await response.json()) as SharedJobResponse;
        if (!response.ok || !payload.job) { setMessage(payload.error || t('portal.client.jobNotFound')); setLoading(false); return; }
        setJob(payload.job); setReports(payload.reports || []); setInvoices(payload.invoices || []); setCharges(payload.charges || null); setCanViewPhotos(payload.canViewPhotos !== false); setLoading(false);
      } catch { setMessage(t('portal.client.jobLoadError')); setLoading(false); }
    }
    void load();
  }, [jobId, router, t]);

  if (loading) return <div className="client-portal-job-detail"><div className="card" role="status" aria-live="polite">{t('portal.common.loading')}</div></div>;

  return (
    <div className="client-portal-job-detail">
      <header style={{ marginBottom: 20 }}><p className="eyebrow">{t('portal.client.portal')}</p><h2>{job?.title || t('portal.client.sharedJob')}</h2><p className="muted">{t('portal.client.sharedJobDescription')}</p></header>
      <PortalClientNav active="appointments" overviewHref={CLIENT_PORTAL_HOME} appointmentsHref={clientPortalJobsPath()} accountHref={CLIENT_SETTINGS_PATH} />
      {message ? <div className="card" role="alert"><p>{message}</p><Link className="btn" href={clientPortalJobsPath()} style={{ marginTop: 12 }}>{t('portal.client.backToSharedJobs')}</Link></div> : job ? <>
        <article className="card">
          <h3>{t('portal.client.appointment')}</h3>
          <p>{t('portal.common.status')}: {translatePortalJobStatus(t, job.status)}</p>
          <p>{t('portal.common.due')}: {job.due_date || t('portal.common.notSet')}</p>
          {job.customer_notes ? <p>{job.customer_notes}</p> : null}
          {charges && charges.jobTotal != null ? <p className="portal-finance-line" style={{ marginTop: 12 }}>
            <span>{t('portal.client.jobTotal')} <strong className="portal-finance-amount">{new Intl.NumberFormat(localeCode, { style: 'currency', currency: 'USD' }).format(charges.jobTotal)}</strong></span>
            <span>{t('portal.client.paid')} <strong>{new Intl.NumberFormat(localeCode, { style: 'currency', currency: 'USD' }).format(charges.paid)}</strong></span>
            <span>{t('portal.client.balanceDue')} <strong className="portal-finance-amount">{new Intl.NumberFormat(localeCode, { style: 'currency', currency: 'USD' }).format(charges.balanceDue || 0)}</strong></span>
          </p> : null}
        </article>

        <ClientSendMessage jobId={job.id} />

        <section className="card" style={{ marginTop: 16 }}><h3>{t('portal.client.reports')}</h3>
          {sharedReports.length === 0 ? <p className="muted">{t('portal.client.noReports')}</p> : sharedReports.map((report) => <div key={report.id} className="list-row"><strong>{report.title}</strong><Link className="btn btn-primary" href={`/report/${report.share_token}`}>{t('portal.client.openReport')}</Link></div>)}
        </section>
        <section className="card" style={{ marginTop: 16 }}><h3>{t('portal.client.photos')}</h3><PhotoGallery jobId={job.id} refreshKey={0} canView={canViewPhotos} customerOnly /></section>
        {invoices.length > 0 ? <section className="card" style={{ marginTop: 16 }}><h3>{t('portal.client.invoices')}</h3>{invoices.map((invoice) => <div key={invoice.id} className="list-row"><div><strong>{translatePortalPaymentStatus(t, invoice.status)}</strong><p className="muted">{invoice.amount != null ? new Intl.NumberFormat(localeCode, { style: 'currency', currency: 'USD' }).format(Number(invoice.amount)) : t('portal.client.amountPending')}{invoice.due_date ? ` · ${t('portal.common.due')} ${invoice.due_date}` : ''}</p></div></div>)}</section> : null}
      </> : null}
    </div>
  );
}
