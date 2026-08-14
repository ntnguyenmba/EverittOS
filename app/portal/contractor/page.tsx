'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { useTranslation } from '@/components/locale-provider';
import { contractorJobDetailPath } from '@/lib/contractor-job-access';
import { supabase } from '@/lib/supabase';
import { performClientLogout } from '@/lib/client-logout';

type PortalDashboardResponse = {
  notLinked?: boolean;
  workerName?: string;
  jobs?: JobRow[];
  totals?: PortalTotals;
  error?: string;
};

type JobRow = {
  id: string;
  title: string | null;
  customerName: string | null;
  address: string | null;
  status: string | null;
  startDate: string | null;
  dueDate: string | null;
  scheduledStart: string | null;
  payAmount: number | null;
  paymentStatus: 'paid' | 'pending' | 'unpaid' | null;
};

type PortalTotals = {
  assigned: number;
  upcoming: number;
  completed: number;
  total: number;
  paid: number;
  owed: number;
};

type AuthResult = { data: { user: { id: string; email?: string | null } | null }; error: { message?: string } | null };

type LoadState = 'loading' | 'ready' | 'error';

const LOAD_TIMEOUT_MS = 10000;

const copy = {
  en: {
    contractor: 'Contractor', dashboard: 'Contractor dashboard', upcomingHeadline: 'upcoming jobs', upcomingHeadlineOne: 'upcoming job', jobs: 'Jobs', schedule: 'Schedule', earnings: 'Earnings', settings: 'Settings', signOut: 'Sign out', signingOut: 'Signing out...',
    loadingTitle: 'Loading your contractor dashboard...', loadingBody: 'This should take only a few seconds.', errorTitle: 'The contractor dashboard could not load', errorSafe: 'No jobs, payments, or earnings were changed.', tryAgain: 'Try again',
    assignedJobs: 'Assigned jobs', upcomingJobs: 'Upcoming jobs', completedJobs: 'Completed jobs', totalEarnings: 'Total earnings', paidToYou: 'Paid to you', stillOwed: 'Still owed',
    job: 'Job', customer: 'Customer', noJobs: 'No assigned jobs yet.', dateNotSet: 'Date not set', scheduleBody: 'Your upcoming assigned jobs appear above in date order.', paid: 'paid', stillOwedLower: 'still owed', earningsBody: 'Earnings are calculated only from contractor payment records linked to your worker profile.',
    yourPay: 'Your pay', payNotRecorded: 'Pay not recorded',
    sessionTimeout: 'Your session took too long to load.', profileTimeout: 'Your contractor profile took too long to load.', assignmentsTimeout: 'Assigned jobs took too long to load.', jobsTimeout: 'Jobs took too long to load.', earningsTimeout: 'Earnings took too long to load.', detailsTimeout: 'Assigned job details took too long to load.', notLinked: 'Your login is not linked to a contractor profile yet. Ask the company owner to link your email to your worker record.', loadFailed: 'The contractor dashboard could not load.',
    status: { scheduled: 'scheduled', completed: 'completed', complete: 'complete', done: 'done', finished: 'finished', closed: 'closed', cancelled: 'cancelled', canceled: 'canceled' }
  },
  es: {
    contractor: 'Contratista', dashboard: 'Panel del contratista', upcomingHeadline: 'trabajos próximos', upcomingHeadlineOne: 'trabajo próximo', jobs: 'Trabajos', schedule: 'Horario', earnings: 'Ganancias', settings: 'Configuración', signOut: 'Cerrar sesión', signingOut: 'Cerrando sesión...',
    loadingTitle: 'Cargando tu panel de contratista...', loadingBody: 'Esto solo debería tardar unos segundos.', errorTitle: 'No se pudo cargar el panel del contratista', errorSafe: 'No se cambiaron trabajos, pagos ni ganancias.', tryAgain: 'Intentar de nuevo',
    assignedJobs: 'Trabajos asignados', upcomingJobs: 'Próximos trabajos', completedJobs: 'Trabajos terminados', totalEarnings: 'Ganancias totales', paidToYou: 'Pagado a ti', stillOwed: 'Pendiente de pago',
    job: 'Trabajo', customer: 'Cliente', noJobs: 'Aún no hay trabajos asignados.', dateNotSet: 'Fecha no definida', scheduleBody: 'Tus próximos trabajos asignados aparecen arriba en orden de fecha.', paid: 'pagado', stillOwedLower: 'pendiente', earningsBody: 'Las ganancias se calculan solo con los registros de pago vinculados a tu perfil de contratista.',
    yourPay: 'Tu pago', payNotRecorded: 'Pago no registrado',
    sessionTimeout: 'Tu sesión tardó demasiado en cargar.', profileTimeout: 'Tu perfil de contratista tardó demasiado en cargar.', assignmentsTimeout: 'Los trabajos asignados tardaron demasiado en cargar.', jobsTimeout: 'Los trabajos tardaron demasiado en cargar.', earningsTimeout: 'Las ganancias tardaron demasiado en cargar.', detailsTimeout: 'Los detalles del trabajo asignado tardaron demasiado en cargar.', notLinked: 'Tu inicio de sesión aún no está vinculado a un perfil de contratista. Pide al propietario de la empresa que vincule tu correo electrónico con tu registro de trabajador.', loadFailed: 'No se pudo cargar el panel del contratista.',
    status: { scheduled: 'programado', completed: 'terminado', complete: 'terminado', done: 'terminado', finished: 'terminado', closed: 'cerrado', cancelled: 'cancelado', canceled: 'cancelado' }
  },
  vi: {
    contractor: 'Nhà thầu', dashboard: 'Bảng điều khiển nhà thầu', upcomingHeadline: 'công việc sắp tới', upcomingHeadlineOne: 'công việc sắp tới', jobs: 'Công việc', schedule: 'Lịch', earnings: 'Thu nhập', settings: 'Cài đặt', signOut: 'Đăng xuất', signingOut: 'Đang đăng xuất...',
    loadingTitle: 'Đang tải bảng điều khiển nhà thầu...', loadingBody: 'Quá trình này chỉ mất vài giây.', errorTitle: 'Không thể tải bảng điều khiển nhà thầu', errorSafe: 'Không có công việc, khoản thanh toán hoặc thu nhập nào bị thay đổi.', tryAgain: 'Thử lại',
    assignedJobs: 'Công việc được giao', upcomingJobs: 'Công việc sắp tới', completedJobs: 'Công việc đã xong', totalEarnings: 'Tổng thu nhập', paidToYou: 'Đã trả cho bạn', stillOwed: 'Còn phải trả',
    job: 'Công việc', customer: 'Khách hàng', noJobs: 'Chưa có công việc được giao.', dateNotSet: 'Chưa có ngày', scheduleBody: 'Các công việc sắp tới của bạn được hiển thị phía trên theo thứ tự ngày.', paid: 'đã trả', stillOwedLower: 'còn phải trả', earningsBody: 'Thu nhập chỉ được tính từ các hồ sơ thanh toán được liên kết với hồ sơ nhà thầu của bạn.',
    yourPay: 'Tiền công của bạn', payNotRecorded: 'Chưa ghi nhận tiền công',
    sessionTimeout: 'Phiên đăng nhập mất quá lâu để tải.', profileTimeout: 'Hồ sơ nhà thầu mất quá lâu để tải.', assignmentsTimeout: 'Công việc được giao mất quá lâu để tải.', jobsTimeout: 'Công việc mất quá lâu để tải.', earningsTimeout: 'Thu nhập mất quá lâu để tải.', detailsTimeout: 'Chi tiết công việc được giao mất quá lâu để tải.', notLinked: 'Tài khoản của bạn chưa được liên kết với hồ sơ nhà thầu. Hãy nhờ chủ công ty liên kết email của bạn với hồ sơ nhân viên.', loadFailed: 'Không thể tải bảng điều khiển nhà thầu.',
    status: { scheduled: 'đã lên lịch', completed: 'đã xong', complete: 'đã xong', done: 'đã xong', finished: 'đã xong', closed: 'đã đóng', cancelled: 'đã hủy', canceled: 'đã hủy' }
  }
} as const;

function withTimeout<T>(promise: PromiseLike<T>, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(timeoutMessage)), LOAD_TIMEOUT_MS);
    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function money(value: number, localeCode: string) {
  return new Intl.NumberFormat(localeCode, { style: 'currency', currency: 'USD' }).format(value);
}

function normalizedStatus(value: string | null) {
  return String(value || 'scheduled').trim().toLowerCase().replace(/\s+/g, '_');
}

export default function ContractorPortalPage() {
  const router = useRouter();
  const { locale } = useTranslation();
  const c = copy[locale] || copy.en;
  const localeCode = locale === 'vi' ? 'vi-VN' : locale === 'es' ? 'es-US' : 'en-US';
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [totals, setTotals] = useState<PortalTotals>({
    assigned: 0,
    upcoming: 0,
    completed: 0,
    total: 0,
    paid: 0,
    owed: 0
  });
  const [signingOut, setSigningOut] = useState(false);

  const jobDate = useCallback((job: JobRow) => {
    const value = job.scheduledStart || job.startDate || job.dueDate;
    if (!value) return c.dateNotSet;
    const date = new Date(value.includes('T') ? value : `${value}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? c.dateNotSet
      : date.toLocaleString(localeCode, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          ...(value.includes('T') ? { hour: 'numeric', minute: '2-digit' } : {})
        });
  }, [c.dateNotSet, localeCode]);

  const statusLabel = useCallback((value: string | null) => {
    const key = normalizedStatus(value) as keyof typeof c.status;
    return c.status[key] || normalizedStatus(value).replaceAll('_', ' ');
  }, [c.status]);

  const load = useCallback(async () => {
    setState('loading');
    setError('');

    try {
      const auth = (await withTimeout(supabase.auth.getUser(), c.sessionTimeout)) as AuthResult;
      const user = auth.data.user;
      if (auth.error || !user) {
        router.replace('/login?next=%2Fportal%2Fcontractor');
        return;
      }

      const response = (await withTimeout(
        fetch('/api/portal/contractor/jobs', { cache: 'no-store' }),
        c.jobsTimeout
      )) as Response;
      if (response.status === 401) {
        router.replace('/login?next=%2Fportal%2Fcontractor');
        return;
      }
      const payload = (await response.json().catch(() => ({}))) as PortalDashboardResponse;
      if (!response.ok) {
        throw new Error(payload.error || c.loadFailed);
      }

      setWorkerName(payload.workerName || user.email || c.contractor);
      if (payload.notLinked) {
        setJobs([]);
        setTotals({ assigned: 0, upcoming: 0, completed: 0, total: 0, paid: 0, owed: 0 });
        setError(c.notLinked);
        setState('error');
        return;
      }

      setJobs(payload.jobs || []);
      setTotals(
        payload.totals || { assigned: 0, upcoming: 0, completed: 0, total: 0, paid: 0, owed: 0 }
      );
      setState('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : c.loadFailed);
      setState('error');
    }
  }, [c, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedJobs = useMemo(
    () => [...jobs].sort((a, b) => String(a.scheduledStart || a.startDate || '').localeCompare(String(b.scheduledStart || b.startDate || ''))),
    [jobs]
  );

  const operationalHeadline = state === 'ready'
    ? `${totals.upcoming} ${totals.upcoming === 1 ? c.upcomingHeadlineOne : c.upcomingHeadline}`
    : c.dashboard;

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await performClientLogout();
      window.location.assign('/login');
    } catch {
      setSigningOut(false);
      router.replace('/login');
    }
  }

  return (
    <AuthenticatedSection role="contractor" className="contractor-dashboard role-dashboard-minimal">
      <header className="card contractor-portal-hero">
        <p className="eyebrow contractor-role-label">{c.contractor}</p>
        <h1>{operationalHeadline}</h1>
        <p className="muted contractor-worker-name">{workerName || c.contractor}</p>
        <nav className="button-row contractor-portal-actions">
          <a className="btn btn-primary" href="#jobs">{c.jobs}</a>
          <a className="btn" href="#schedule">{c.schedule}</a>
          <a className="btn" href="#earnings">{c.earnings}</a>
          <Link className="btn" href="/portal/contractor/settings">{c.settings}</Link>
          <button type="button" className="btn contractor-signout" disabled={signingOut} onClick={() => void signOut()}>{signingOut ? c.signingOut : c.signOut}</button>
        </nav>
      </header>

      {state === 'loading' ? <section className="card" aria-live="polite"><h3 style={{ marginTop: 0 }}>{c.loadingTitle}</h3><p className="muted">{c.loadingBody}</p></section> : null}

      {state === 'error' ? (
        <section className="card" role="alert">
          <h3 style={{ marginTop: 0 }}>{c.errorTitle}</h3>
          <p>{error}</p>
          <p className="muted">{c.errorSafe}</p>
          <button type="button" className="btn btn-primary" onClick={() => void load()}>{c.tryAgain}</button>
        </section>
      ) : null}

      {state === 'ready' ? (
        <>
          <section className="metric-grid contractor-metrics">
            <article className="card contractor-metric contractor-job-metric"><span className="muted">{c.assignedJobs}</span><h2>{totals.assigned}</h2></article>
            <article className="card contractor-metric contractor-job-metric contractor-job-metric-primary"><span className="muted">{c.upcomingJobs}</span><h2>{totals.upcoming}</h2></article>
            <article className="card contractor-metric contractor-job-metric"><span className="muted">{c.completedJobs}</span><h2>{totals.completed}</h2></article>
            <article className="card contractor-metric contractor-earnings-metric"><span className="muted">{c.totalEarnings}</span><h2>{money(totals.total, localeCode)}</h2></article>
            <article className="card contractor-metric contractor-earnings-metric"><span className="muted">{c.paidToYou}</span><h2>{money(totals.paid, localeCode)}</h2></article>
            <article className="card contractor-metric contractor-earnings-metric"><span className="muted">{c.stillOwed}</span><h2>{money(totals.owed, localeCode)}</h2></article>
          </section>

          <section id="jobs" className="card contractor-content-card">
            <h3 style={{ marginTop: 0 }}>{c.jobs}</h3>
            {sortedJobs.length ? (
              <div className="job-visits-list">
                {sortedJobs.map((job) => (
                  <article key={job.id} className="list-row portal-job-row">
                    <div>
                      <Link href={contractorJobDetailPath(job.id)}>
                        <strong>{job.title || c.job}</strong>
                      </Link>
                      <p className="muted" style={{ margin: '5px 0 0' }}>{jobDate(job)}</p>
                      <p style={{ margin: '5px 0 0' }}>{job.customerName || c.customer}{job.address ? ` · ${job.address}` : ''}</p>
                    </div>
                    <div className="portal-job-finance">
                      <span>{statusLabel(job.status)}</span>
                      {job.payAmount == null ? (
                        <span className="portal-finance-empty">{c.payNotRecorded}</span>
                      ) : (
                        <strong className="portal-finance-amount">
                          {c.yourPay}: {money(job.payAmount, localeCode)}
                        </strong>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="muted">{c.noJobs}</p>}
          </section>

          <section id="schedule" className="card contractor-content-card"><h3 style={{ marginTop: 0 }}>{c.schedule}</h3><p className="muted">{c.scheduleBody}</p></section>

          <section id="earnings" className="card contractor-content-card">
            <h3 style={{ marginTop: 0 }}>{c.earnings}</h3>
            <p><strong>{money(totals.paid, localeCode)}</strong> {c.paid} · <strong>{money(totals.owed, localeCode)}</strong> {c.stillOwedLower}</p>
            <p className="muted">{c.earningsBody}</p>
          </section>
        </>
      ) : null}
    </AuthenticatedSection>
  );
}
