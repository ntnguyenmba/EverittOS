'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { PhotoGallery } from '@/components/photo-gallery';
import { CLIENT_SETTINGS_PATH } from '@/lib/client-portal';
import { clientPortalJobsPath, CLIENT_PORTAL_HOME } from '@/lib/portal-access';
import { supabase } from '@/lib/supabase';

type ClientJob = {
  id: string;
  title: string;
  status: string | null;
  customer_notes: string | null;
  due_date: string | null;
};

type ClientReport = {
  id: string;
  title: string;
  job_id: string;
  share_token: string | null;
  share_revoked_at: string | null;
};

type ClientInvoice = {
  id: string;
  job_id: string | null;
  amount: number | null;
  status: string | null;
  due_date: string | null;
};

type SharedJobResponse = {
  job?: ClientJob;
  reports?: ClientReport[];
  invoices?: ClientInvoice[];
  canViewPhotos?: boolean;
  error?: string;
};

export default function ClientPortalJobDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const jobId = String(params?.id || '');
  const [job, setJob] = useState<ClientJob | null>(null);
  const [reports, setReports] = useState<ClientReport[]>([]);
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [canViewPhotos, setCanViewPhotos] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const sharedReports = useMemo(
    () => reports.filter((report) => report.share_token && !report.share_revoked_at),
    [reports]
  );

  useEffect(() => {
    async function load() {
      if (!jobId) {
        router.replace(clientPortalJobsPath());
        return;
      }

      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.push(`/login?next=${encodeURIComponent(clientPortalJobsPath(jobId))}`);
        return;
      }

      try {
        const response = await fetch(`/api/portal/client/jobs/${encodeURIComponent(jobId)}`, {
          method: 'GET',
          cache: 'no-store'
        });
        const payload = (await response.json()) as SharedJobResponse;

        if (!response.ok || !payload.job) {
          setMessage(payload.error || 'This shared job could not be found.');
          setLoading(false);
          return;
        }

        setJob(payload.job);
        setReports(payload.reports || []);
        setInvoices(payload.invoices || []);
        setCanViewPhotos(payload.canViewPhotos !== false);
        setLoading(false);
      } catch {
        setMessage('This shared job could not be loaded. Please try again.');
        setLoading(false);
      }
    }

    void load();
  }, [jobId, router]);

  if (loading) {
    return (
      <AuthenticatedSection role="client">
        <div className="card" role="status" aria-live="polite">
          Loading shared job...
        </div>
      </AuthenticatedSection>
    );
  }

  return (
    <AuthenticatedSection role="client">
      <header style={{ marginBottom: 20 }}>
        <p className="eyebrow">Client portal</p>
        <h2>{job?.title || 'Shared job'}</h2>
        <p className="muted">View appointment details, reports, and photos shared with you.</p>
      </header>

      <nav className="inline-actions" style={{ marginBottom: 16, flexWrap: 'wrap' }} aria-label="Portal sections">
        <Link href={CLIENT_PORTAL_HOME} className="btn">
          Overview
        </Link>
        <Link href={clientPortalJobsPath()} className="btn btn-primary" aria-current="page">
          Appointments
        </Link>
        <Link href={CLIENT_SETTINGS_PATH} className="btn">
          Account
        </Link>
      </nav>

      {message ? (
        <div className="card" role="alert">
          <p>{message}</p>
          <Link className="btn" href={clientPortalJobsPath()} style={{ marginTop: 12 }}>
            Back to shared jobs
          </Link>
        </div>
      ) : job ? (
        <>
          <article className="card">
            <h3>Appointment</h3>
            <p>Status: {job.status || 'scheduled'}</p>
            <p>Date: {job.due_date || 'Not set'}</p>
            {job.customer_notes ? <p>{job.customer_notes}</p> : null}
          </article>

          <section className="card" style={{ marginTop: 16 }}>
            <h3>Reports</h3>
            {sharedReports.length === 0 ? (
              <p className="muted">No reports have been shared for this job yet.</p>
            ) : (
              sharedReports.map((report) => (
                <div key={report.id} className="list-row">
                  <strong>{report.title}</strong>
                  <Link className="btn btn-primary" href={`/report/${report.share_token}`}>
                    Open report
                  </Link>
                </div>
              ))
            )}
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <h3>Photos</h3>
            <PhotoGallery jobId={job.id} refreshKey={0} canView={canViewPhotos} customerOnly />
          </section>

          {invoices.length > 0 ? (
            <section className="card" style={{ marginTop: 16 }}>
              <h3>Invoices</h3>
              {invoices.map((invoice) => (
                <div key={invoice.id} className="list-row">
                  <div>
                    <strong>{invoice.status || 'open'}</strong>
                    <p className="muted">
                      {invoice.amount != null ? `$${Number(invoice.amount).toFixed(2)}` : 'Amount pending'}
                      {invoice.due_date ? ` · Due ${invoice.due_date}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </section>
          ) : null}
        </>
      ) : null}
    </AuthenticatedSection>
  );
}
