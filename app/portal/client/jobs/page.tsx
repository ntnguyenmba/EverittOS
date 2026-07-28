'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { useTranslation } from '@/components/locale-provider';
import { CLIENT_SETTINGS_PATH } from '@/lib/client-portal';
import { clientPortalJobsPath, CLIENT_PORTAL_HOME } from '@/lib/portal-access';
import { isClientRole, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type ClientJob = {
  id: string;
  title: string;
  status: string | null;
  due_date: string | null;
};

const COPY = {
  en: {
    noSharedMessage: 'There are currently no shared jobs for your account. When a business shares a job with you, it will appear here.',
    loading: 'Loading your shared jobs...',
    portal: 'Client portal',
    title: 'Shared jobs',
    description: 'Only jobs shared with you are listed here.',
    sections: 'Portal sections',
    overview: 'Overview',
    appointments: 'Appointments',
    account: 'Account',
    noSharedTitle: 'No shared jobs yet',
    scheduled: 'scheduled',
    openJob: 'Open job'
  },
  es: {
    noSharedMessage: 'Actualmente no hay trabajos compartidos con tu cuenta. Cuando una empresa comparta un trabajo contigo, aparecerá aquí.',
    loading: 'Cargando tus trabajos compartidos...',
    portal: 'Portal del cliente',
    title: 'Trabajos compartidos',
    description: 'Aquí solo aparecen los trabajos compartidos contigo.',
    sections: 'Secciones del portal',
    overview: 'Resumen',
    appointments: 'Citas',
    account: 'Cuenta',
    noSharedTitle: 'Aún no hay trabajos compartidos',
    scheduled: 'programado',
    openJob: 'Abrir trabajo'
  },
  vi: {
    noSharedMessage: 'Hiện chưa có công việc nào được chia sẻ với tài khoản của bạn. Khi một doanh nghiệp chia sẻ công việc với bạn, công việc đó sẽ xuất hiện tại đây.',
    loading: 'Đang tải các công việc được chia sẻ...',
    portal: 'Cổng thông tin khách hàng',
    title: 'Công việc được chia sẻ',
    description: 'Chỉ những công việc được chia sẻ với bạn mới xuất hiện tại đây.',
    sections: 'Các mục trong cổng thông tin',
    overview: 'Tổng quan',
    appointments: 'Lịch hẹn',
    account: 'Tài khoản',
    noSharedTitle: 'Chưa có công việc được chia sẻ',
    scheduled: 'đã lên lịch',
    openJob: 'Mở công việc'
  }
} as const;

export default function ClientPortalJobsPage() {
  const router = useRouter();
  const { locale } = useTranslation();
  const copy = COPY[locale];
  const [jobs, setJobs] = useState<ClientJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

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

      if (jobIds.length === 1) {
        router.replace(clientPortalJobsPath(jobIds[0]));
        return;
      }

      if (jobIds.length === 0) {
        setJobs([]);
        setMessage(copy.noSharedMessage);
        setLoading(false);
        return;
      }

      const { data: jobRows } = await supabase
        .from('jobs')
        .select('id, title, status, due_date')
        .in('id', jobIds)
        .order('created_at', { ascending: false });

      setJobs((jobRows || []) as ClientJob[]);
      setLoading(false);
    }

    void load();
  }, [copy.noSharedMessage, router]);

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
        <h2>{copy.title}</h2>
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
        <div className="card" role="status">
          <h3>{copy.noSharedTitle}</h3>
          <p>{message}</p>
        </div>
      ) : (
        jobs.map((job) => (
          <article key={job.id} className="card" style={{ marginTop: 16 }}>
            <div className="list-row">
              <div>
                <strong>{job.title}</strong>
                <p className="muted">
                  {job.status || copy.scheduled}
                  {job.due_date ? ` · ${job.due_date}` : ''}
                </p>
              </div>
              <Link className="btn btn-primary" href={clientPortalJobsPath(job.id)}>
                {copy.openJob}
              </Link>
            </div>
          </article>
        ))
      )}
    </AuthenticatedSection>
  );
}
