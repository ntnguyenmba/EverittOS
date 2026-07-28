'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { PhotoGallery } from '@/components/photo-gallery';
import { useTranslation } from '@/components/locale-provider';
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

const COPY = {
  en: {
    notFound: 'This shared job could not be found.',
    loadError: 'This shared job could not be loaded. Please try again.',
    loading: 'Loading shared job...',
    portal: 'Client portal',
    sharedJob: 'Shared job',
    description: 'View appointment details, reports, and photos shared with you.',
    sections: 'Portal sections',
    overview: 'Overview',
    appointments: 'Appointments',
    account: 'Account',
    back: 'Back to shared jobs',
    appointment: 'Appointment',
    status: 'Status',
    scheduled: 'scheduled',
    date: 'Date',
    notSet: 'Not set',
    reports: 'Reports',
    noReports: 'No reports have been shared for this job yet.',
    openReport: 'Open report',
    photos: 'Photos',
    invoices: 'Invoices',
    open: 'open',
    amountPending: 'Amount pending',
    due: 'Due'
  },
  es: {
    notFound: 'No se pudo encontrar este trabajo compartido.',
    loadError: 'No se pudo cargar este trabajo compartido. Inténtalo de nuevo.',
    loading: 'Cargando trabajo compartido...',
    portal: 'Portal del cliente',
    sharedJob: 'Trabajo compartido',
    description: 'Consulta los detalles de la cita, los informes y las fotos compartidas contigo.',
    sections: 'Secciones del portal',
    overview: 'Resumen',
    appointments: 'Citas',
    account: 'Cuenta',
    back: 'Volver a trabajos compartidos',
    appointment: 'Cita',
    status: 'Estado',
    scheduled: 'programado',
    date: 'Fecha',
    notSet: 'Sin definir',
    reports: 'Informes',
    noReports: 'Todavía no se han compartido informes para este trabajo.',
    openReport: 'Abrir informe',
    photos: 'Fotos',
    invoices: 'Facturas',
    open: 'abierta',
    amountPending: 'Importe pendiente',
    due: 'Vence'
  },
  vi: {
    notFound: 'Không tìm thấy công việc được chia sẻ này.',
    loadError: 'Không thể tải công việc được chia sẻ này. Vui lòng thử lại.',
    loading: 'Đang tải công việc được chia sẻ...',
    portal: 'Cổng thông tin khách hàng',
    sharedJob: 'Công việc được chia sẻ',
    description: 'Xem chi tiết lịch hẹn, báo cáo và hình ảnh được chia sẻ với bạn.',
    sections: 'Các mục trong cổng thông tin',
    overview: 'Tổng quan',
    appointments: 'Lịch hẹn',
    account: 'Tài khoản',
    back: 'Quay lại công việc được chia sẻ',
    appointment: 'Lịch hẹn',
    status: 'Trạng thái',
    scheduled: 'đã lên lịch',
    date: 'Ngày',
    notSet: 'Chưa đặt',
    reports: 'Báo cáo',
    noReports: 'Chưa có báo cáo nào được chia sẻ cho công việc này.',
    openReport: 'Mở báo cáo',
    photos: 'Hình ảnh',
    invoices: 'Hóa đơn',
    open: 'đang mở',
    amountPending: 'Số tiền đang chờ',
    due: 'Hạn thanh toán'
  }
} as const;

export default function ClientPortalJobDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { locale } = useTranslation();
  const copy = COPY[locale];
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
          setMessage(payload.error || copy.notFound);
          setLoading(false);
          return;
        }

        setJob(payload.job);
        setReports(payload.reports || []);
        setInvoices(payload.invoices || []);
        setCanViewPhotos(payload.canViewPhotos !== false);
        setLoading(false);
      } catch {
        setMessage(copy.loadError);
        setLoading(false);
      }
    }

    void load();
  }, [copy.loadError, copy.notFound, jobId, router]);

  if (loading) {
    return (
      <AuthenticatedSection role="client">
        <div className="card" role="status" aria-live="polite">
          {copy.loading}
        </div>
      </AuthenticatedSection>
    );
  }

  return (
    <AuthenticatedSection role="client">
      <header style={{ marginBottom: 20 }}>
        <p className="eyebrow">{copy.portal}</p>
        <h2>{job?.title || copy.sharedJob}</h2>
        <p className="muted">{copy.description}</p>
      </header>

      <nav className="inline-actions" style={{ marginBottom: 16, flexWrap: 'wrap' }} aria-label={copy.sections}>
        <Link href={CLIENT_PORTAL_HOME} className="btn">
          {copy.overview}
        </Link>
        <Link href={clientPortalJobsPath()} className="btn btn-primary" aria-current="page">
          {copy.appointments}
        </Link>
        <Link href={CLIENT_SETTINGS_PATH} className="btn">
          {copy.account}
        </Link>
      </nav>

      {message ? (
        <div className="card" role="alert">
          <p>{message}</p>
          <Link className="btn" href={clientPortalJobsPath()} style={{ marginTop: 12 }}>
            {copy.back}
          </Link>
        </div>
      ) : job ? (
        <>
          <article className="card">
            <h3>{copy.appointment}</h3>
            <p>{copy.status}: {job.status || copy.scheduled}</p>
            <p>{copy.date}: {job.due_date || copy.notSet}</p>
            {job.customer_notes ? <p>{job.customer_notes}</p> : null}
          </article>

          <section className="card" style={{ marginTop: 16 }}>
            <h3>{copy.reports}</h3>
            {sharedReports.length === 0 ? (
              <p className="muted">{copy.noReports}</p>
            ) : (
              sharedReports.map((report) => (
                <div key={report.id} className="list-row">
                  <strong>{report.title}</strong>
                  <Link className="btn btn-primary" href={`/report/${report.share_token}`}>
                    {copy.openReport}
                  </Link>
                </div>
              ))
            )}
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <h3>{copy.photos}</h3>
            <PhotoGallery jobId={job.id} refreshKey={0} canView={canViewPhotos} customerOnly />
          </section>

          {invoices.length > 0 ? (
            <section className="card" style={{ marginTop: 16 }}>
              <h3>{copy.invoices}</h3>
              {invoices.map((invoice) => (
                <div key={invoice.id} className="list-row">
                  <div>
                    <strong>{invoice.status || copy.open}</strong>
                    <p className="muted">
                      {invoice.amount != null ? `$${Number(invoice.amount).toFixed(2)}` : copy.amountPending}
                      {invoice.due_date ? ` · ${copy.due} ${invoice.due_date}` : ''}
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
