'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { useTranslation } from '@/components/locale-provider';
import { supabase } from '@/lib/supabase';
import { performClientLogout } from '@/lib/client-logout';

type WorkerRow = {
  id: string;
  name: string | null;
  email: string | null;
  auth_user_id: string | null;
};

type AssignmentRow = {
  job_id: string;
  worker_id: string;
};

type JobRow = {
  id: string;
  title: string | null;
  customer_name: string | null;
  address: string | null;
  status: string | null;
  start_date: string | null;
  due_date: string | null;
  scheduled_start: string | null;
  assigned_to: string | null;
};

type LaborRow = {
  id: string;
  job_id: string;
  worker_id: string;
  total_cost: number | string | null;
  payment_status: string | null;
};

type LoadState = 'loading' | 'ready' | 'error';

const LOAD_TIMEOUT_MS = 10000;

const copy = {
  en: {
    contractor: 'Contractor', dashboard: 'Contractor dashboard', welcome: 'Welcome back', jobs: 'Jobs', schedule: 'Schedule', earnings: 'Earnings', settings: 'Settings', signOut: 'Sign out', signingOut: 'Signing out...',
    loadingTitle: 'Loading your contractor dashboard...', loadingBody: 'This should take only a few seconds.', errorTitle: 'The contractor dashboard could not load', errorSafe: 'No jobs, payments, or earnings were changed.', tryAgain: 'Try again',
    assignedJobs: 'Assigned jobs', upcomingJobs: 'Upcoming jobs', completedJobs: 'Completed jobs', totalEarnings: 'Total earnings', paidToYou: 'Paid to you', stillOwed: 'Still owed',
    job: 'Job', customer: 'Customer', noJobs: 'No assigned jobs yet.', dateNotSet: 'Date not set', scheduleBody: 'Your upcoming assigned jobs appear above in date order.', paid: 'paid', stillOwedLower: 'still owed', earningsBody: 'Earnings are calculated only from contractor payment records linked to your worker profile.',
    sessionTimeout: 'Your session took too long to load.', profileTimeout: 'Your contractor profile took too long to load.', assignmentsTimeout: 'Assigned jobs took too long to load.', jobsTimeout: 'Jobs took too long to load.', earningsTimeout: 'Earnings took too long to load.', detailsTimeout: 'Assigned job details took too long to load.', notLinked: 'Your login is not linked to a contractor profile yet. Ask the company owner to link your email to your worker record.', loadFailed: 'The contractor dashboard could not load.',
    status: { scheduled: 'scheduled', completed: 'completed', complete: 'complete', done: 'done', finished: 'finished', closed: 'closed', cancelled: 'cancelled', canceled: 'canceled' }
  },
  es: {
    contractor: 'Contratista', dashboard: 'Panel del contratista', welcome: 'Bienvenido de nuevo', jobs: 'Trabajos', schedule: 'Horario', earnings: 'Ganancias', settings: 'Configuración', signOut: 'Cerrar sesión', signingOut: 'Cerrando sesión...',
    loadingTitle: 'Cargando tu panel de contratista...', loadingBody: 'Esto solo debería tardar unos segundos.', errorTitle: 'No se pudo cargar el panel del contratista', errorSafe: 'No se cambiaron trabajos, pagos ni ganancias.', tryAgain: 'Intentar de nuevo',
    assignedJobs: 'Trabajos asignados', upcomingJobs: 'Próximos trabajos', completedJobs: 'Trabajos terminados', totalEarnings: 'Ganancias totales', paidToYou: 'Pagado a ti', stillOwed: 'Pendiente de pago',
    job: 'Trabajo', customer: 'Cliente', noJobs: 'Aún no hay trabajos asignados.', dateNotSet: 'Fecha no definida', scheduleBody: 'Tus próximos trabajos asignados aparecen arriba en orden de fecha.', paid: 'pagado', stillOwedLower: 'pendiente', earningsBody: 'Las ganancias se calculan solo con los registros de pago vinculados a tu perfil de contratista.',
    sessionTimeout: 'Tu sesión tardó demasiado en cargar.', profileTimeout: 'Tu perfil de contratista tardó demasiado en cargar.', assignmentsTimeout: 'Los trabajos asignados tardaron demasiado en cargar.', jobsTimeout: 'Los trabajos tardaron demasiado en cargar.', earningsTimeout: 'Las ganancias tardaron demasiado en cargar.', detailsTimeout: 'Los detalles del trabajo asignado tardaron demasiado en cargar.', notLinked: 'Tu inicio de sesión aún no está vinculado a un perfil de contratista. Pide al propietario de la empresa que vincule tu correo electrónico con tu registro de trabajador.', loadFailed: 'No se pudo cargar el panel del contratista.',
    status: { scheduled: 'programado', completed: 'terminado', complete: 'terminado', done: 'terminado', finished: 'terminado', closed: 'cerrado', cancelled: 'cancelado', canceled: 'cancelado' }
  },
  vi: {
    contractor: 'Nhà thầu', dashboard: 'Bảng điều khiển nhà thầu', welcome: 'Chào mừng trở lại', jobs: 'Công việc', schedule: 'Lịch', earnings: 'Thu nhập', settings: 'Cài đặt', signOut: 'Đăng xuất', signingOut: 'Đang đăng xuất...',
    loadingTitle: 'Đang tải bảng điều khiển nhà thầu...', loadingBody: 'Quá trình này chỉ mất vài giây.', errorTitle: 'Không thể tải bảng điều khiển nhà thầu', errorSafe: 'Không có công việc, khoản thanh toán hoặc thu nhập nào bị thay đổi.', tryAgain: 'Thử lại',
    assignedJobs: 'Công việc được giao', upcomingJobs: 'Công việc sắp tới', completedJobs: 'Công việc đã xong', totalEarnings: 'Tổng thu nhập', paidToYou: 'Đã trả cho bạn', stillOwed: 'Còn phải trả',
    job: 'Công việc', customer: 'Khách hàng', noJobs: 'Chưa có công việc được giao.', dateNotSet: 'Chưa có ngày', scheduleBody: 'Các công việc sắp tới của bạn được hiển thị phía trên theo thứ tự ngày.', paid: 'đã trả', stillOwedLower: 'còn phải trả', earningsBody: 'Thu nhập chỉ được tính từ các hồ sơ thanh toán được liên kết với hồ sơ nhà thầu của bạn.',
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

function isCompleted(value: string | null) {
  return ['completed', 'complete', 'done', 'finished', 'closed'].includes(normalizedStatus(value));
}

function isCancelled(value: string | null) {
  return ['cancelled', 'canceled'].includes(normalizedStatus(value));
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
  const [labor, setLabor] = useState<LaborRow[]>([]);
  const [signingOut, setSigningOut] = useState(false);

  const jobDate = useCallback((job: JobRow) => {
    const value = job.scheduled_start || job.start_date || job.due_date;
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
      const auth = await withTimeout(supabase.auth.getUser(), c.sessionTimeout);
      const user = auth.data.user;
      if (auth.error || !user) {
        router.replace('/login?next=%2Fportal%2Fcontractor');
        return;
      }

      const email = String(user.email || '').trim().toLowerCase();
      const workerFields = 'id, name, email, auth_user_id';
      const [byUser, byEmail] = await Promise.all([
        withTimeout(supabase.from('workers').select(workerFields).eq('auth_user_id', user.id), c.profileTimeout),
        email
          ? withTimeout(supabase.from('workers').select(workerFields).ilike('email', email), c.profileTimeout)
          : Promise.resolve({ data: [] as WorkerRow[], error: null })
      ]);

      if (byUser.error && byEmail.error) throw new Error(byUser.error.message || byEmail.error.message);

      const workerMap = new Map<string, WorkerRow>();
      for (const row of [...((byUser.data || []) as WorkerRow[]), ...((byEmail.data || []) as WorkerRow[])]) workerMap.set(row.id, row);
      const workers = Array.from(workerMap.values());
      const workerIds = workers.map((row) => row.id).filter(Boolean);
      setWorkerName(workers.find((row) => row.name?.trim())?.name?.trim() || email || c.contractor);

      if (!workerIds.length) {
        setJobs([]);
        setLabor([]);
        setError(c.notLinked);
        setState('error');
        return;
      }

      const [assignmentsResult, directJobsResult, laborResult] = await Promise.all([
        withTimeout(supabase.from('job_assignments').select('job_id, worker_id').in('worker_id', workerIds), c.assignmentsTimeout),
        withTimeout(supabase.from('jobs').select('id, title, customer_name, address, status, start_date, due_date, scheduled_start, assigned_to').in('assigned_to', workerIds), c.jobsTimeout),
        withTimeout(supabase.from('job_labor').select('id, job_id, worker_id, total_cost, payment_status').in('worker_id', workerIds), c.earningsTimeout)
      ]);

      if (assignmentsResult.error) throw new Error(assignmentsResult.error.message);
      if (directJobsResult.error) throw new Error(directJobsResult.error.message);
      if (laborResult.error) throw new Error(laborResult.error.message);

      const assignmentJobIds = Array.from(new Set(((assignmentsResult.data || []) as AssignmentRow[]).map((row) => row.job_id).filter(Boolean)));
      let assignedJobs: JobRow[] = [];
      if (assignmentJobIds.length) {
        const assignedResult = await withTimeout(
          supabase.from('jobs').select('id, title, customer_name, address, status, start_date, due_date, scheduled_start, assigned_to').in('id', assignmentJobIds),
          c.detailsTimeout
        );
        if (assignedResult.error) throw new Error(assignedResult.error.message);
        assignedJobs = (assignedResult.data || []) as JobRow[];
      }

      const merged = new Map<string, JobRow>();
      for (const job of [...((directJobsResult.data || []) as JobRow[]), ...assignedJobs]) merged.set(job.id, job);
      setJobs(Array.from(merged.values()));
      setLabor((laborResult.data || []) as LaborRow[]);
      setState('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : c.loadFailed);
      setState('error');
    }
  }, [c, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const currentJobs = jobs.filter((job) => !isCompleted(job.status) && !isCancelled(job.status));
    const completedJobs = jobs.filter((job) => isCompleted(job.status));
    const total = labor.reduce((sum, row) => sum + Number(row.total_cost || 0), 0);
    const paid = labor.filter((row) => normalizedStatus(row.payment_status) === 'paid').reduce((sum, row) => sum + Number(row.total_cost || 0), 0);
    return { assigned: jobs.length, upcoming: currentJobs.length, completed: completedJobs.length, total, paid, owed: Math.max(0, total - paid) };
  }, [jobs, labor]);

  const sortedJobs = useMemo(
    () => [...jobs].sort((a, b) => String(a.scheduled_start || a.start_date || '').localeCompare(String(b.scheduled_start || b.start_date || ''))),
    [jobs]
  );

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
      <header className="card" style={{ marginBottom: 18 }}>
        <p className="eyebrow" style={{ margin: '0 0 12px' }}>{c.dashboard}</p>
        <h1 style={{ marginBottom: 6 }}>{c.welcome}</h1>
        <p className="muted" style={{ margin: 0 }}>{workerName || c.contractor}</p>
        <nav className="button-row contractor-portal-actions" style={{ marginTop: 20 }}>
          <a className="btn btn-primary" href="#jobs">{c.jobs}</a>
          <a className="btn" href="#schedule">{c.schedule}</a>
          <a className="btn" href="#earnings">{c.earnings}</a>
          <Link className="btn" href="/portal/contractor/settings">{c.settings}</Link>
          <button type="button" className="btn" disabled={signingOut} onClick={() => void signOut()}>{signingOut ? c.signingOut : c.signOut}</button>
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
          <section className="metric-grid" style={{ marginBottom: 18 }}>
            <article className="card"><span className="muted">{c.assignedJobs}</span><h2>{totals.assigned}</h2></article>
            <article className="card"><span className="muted">{c.upcomingJobs}</span><h2>{totals.upcoming}</h2></article>
            <article className="card"><span className="muted">{c.completedJobs}</span><h2>{totals.completed}</h2></article>
            <article className="card"><span className="muted">{c.totalEarnings}</span><h2>{money(totals.total, localeCode)}</h2></article>
            <article className="card"><span className="muted">{c.paidToYou}</span><h2>{money(totals.paid, localeCode)}</h2></article>
            <article className="card"><span className="muted">{c.stillOwed}</span><h2>{money(totals.owed, localeCode)}</h2></article>
          </section>

          <section id="jobs" className="card" style={{ marginBottom: 18 }}>
            <h3 style={{ marginTop: 0 }}>{c.jobs}</h3>
            {sortedJobs.length ? (
              <div className="job-visits-list">
                {sortedJobs.map((job) => (
                  <article key={job.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                    <div>
                      <strong>{job.title || c.job}</strong>
                      <p className="muted" style={{ margin: '5px 0 0' }}>{jobDate(job)}</p>
                      <p style={{ margin: '5px 0 0' }}>{job.customer_name || c.customer}{job.address ? ` · ${job.address}` : ''}</p>
                    </div>
                    <span>{statusLabel(job.status)}</span>
                  </article>
                ))}
              </div>
            ) : <p className="muted">{c.noJobs}</p>}
          </section>

          <section id="schedule" className="card" style={{ marginBottom: 18 }}><h3 style={{ marginTop: 0 }}>{c.schedule}</h3><p className="muted">{c.scheduleBody}</p></section>

          <section id="earnings" className="card">
            <h3 style={{ marginTop: 0 }}>{c.earnings}</h3>
            <p><strong>{money(totals.paid, localeCode)}</strong> {c.paid} · <strong>{money(totals.owed, localeCode)}</strong> {c.stillOwedLower}</p>
            <p className="muted">{c.earningsBody}</p>
          </section>
        </>
      ) : null}
    </AuthenticatedSection>
  );
}
