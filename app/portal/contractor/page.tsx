'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useTranslation } from '@/components/locale-provider';
import { PhotoUpload } from '@/components/photo-upload';
import { normalizePlan, photoUploadAllowed } from '@/lib/everittos-plans';
import { limitsForPlan } from '@/lib/everittos-limits';
import {
  buildContractorJobCards,
  buildContractorPaymentHistory,
  computeContractorDashboardMetrics,
  CONTRACTOR_HOME_PATH,
  CONTRACTOR_SETTINGS_PATH,
  contractorIdentityFromWorkers,
  contractorNavItems,
  formatContractorMoney,
  type ContractorDashboardMetrics,
  type ContractorJobCardModel,
  type ContractorJobRow,
  type ContractorLaborRow,
  type ContractorLoadErrorCode,
  type ContractorPaymentHistoryRow
} from '@/lib/contractor-dashboard';
import { contractorJobDetailPath, isLegacyContractorShareNotification } from '@/lib/contractor-job-access';
import {
  contractorJobCalendarEvent,
  downloadCalendarIcs,
  googleCalendarEventUrl,
  outlookCalendarEventUrl
} from '@/lib/calendar-links';
import { performClientLogout } from '@/lib/client-logout';
import { translatePortalJobStatus, translatePortalPaymentStatus } from '@/lib/portal-status-i18n';
import { isContractorRole, normalizeRole } from '@/lib/roles';
import { localToday } from '@/lib/schedule-times';
import { supabase } from '@/lib/supabase';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { buildAssignmentWorkerIdsByJob } from '@/lib/worker-assignment';

const EMPTY_METRICS: ContractorDashboardMetrics = {
  assignedJobs: 0,
  upcomingJobs: 0,
  completedJobs: 0,
  totalEarnings: 0,
  paidEarnings: 0,
  owedEarnings: 0
};

type Translate = (path: string, values?: Record<string, string | number>) => string;

type EarningsCopy = {
  completedWork: string;
  keepGoing: string;
  paymentRecordsPending: string;
  paidToYou: string;
};

const EARNINGS_COPY: Record<'en' | 'es' | 'vi', EarningsCopy> = {
  en: {
    completedWork: 'jobs completed',
    keepGoing: 'Every completed job builds your work history and opens the door to more assignments.',
    paymentRecordsPending: 'No earnings available yet.',
    paidToYou: 'Paid to you'
  },
  es: {
    completedWork: 'trabajos completados',
    keepGoing: 'Cada trabajo completado fortalece tu historial y abre la puerta a más asignaciones.',
    paymentRecordsPending: 'Aún no hay ganancias disponibles.',
    paidToYou: 'Pagado a ti'
  },
  vi: {
    completedWork: 'công việc đã hoàn thành',
    keepGoing: 'Mỗi công việc hoàn thành sẽ xây dựng lịch sử làm việc và giúp bạn nhận thêm công việc mới.',
    paymentRecordsPending: 'Chưa có thu nhập để hiển thị.',
    paidToYou: 'Đã trả cho bạn'
  }
};

function logContractorError(code: ContractorLoadErrorCode, detail: string) {
  if (code === 'worker_not_linked' || process.env.NODE_ENV !== 'production') {
    console.error(`[contractor-dashboard] ${code}: ${detail}`);
  }
}

function errorMessage(code: ContractorLoadErrorCode, t: Translate): string {
  switch (code) {
    case 'worker_not_linked':
      return t('portal.contractor.errors.workerNotLinked');
    case 'assignment_query_failed':
      return t('portal.contractor.errors.assignmentsQueryFailed');
    case 'jobs_query_failed':
      return t('portal.contractor.errors.jobsQueryFailed');
    case 'earnings_query_failed':
    case 'payment_query_failed':
      return t('portal.contractor.errors.laborQueryFailed');
    case 'access_blocked':
      return t('portal.contractor.errors.permissionDenied');
    case 'worker_lookup_failed':
    default:
      return t('portal.contractor.errors.unknown');
  }
}

function normalizedJobStatus(status: string) {
  return String(status || '').trim().toLowerCase().replace(/\s+/g, '_');
}

const NAV_LABEL_KEYS: Record<string, string> = {
  overview: 'portal.contractor.nav.dashboard',
  jobs: 'portal.contractor.nav.jobs',
  schedule: 'portal.contractor.nav.schedule',
  earnings: 'portal.contractor.nav.earnings',
  account: 'portal.contractor.nav.settings'
};

export default function ContractorPortalPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const earningsCopy = EARNINGS_COPY[locale];
  const [plan, setPlan] = useState(normalizePlan('free'));
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [gateMessage, setGateMessage] = useState('');
  const [errors, setErrors] = useState<ContractorLoadErrorCode[]>([]);
  const [metrics, setMetrics] = useState<ContractorDashboardMetrics>(EMPTY_METRICS);
  const [jobCards, setJobCards] = useState<ContractorJobCardModel[]>([]);
  const [history, setHistory] = useState<ContractorPaymentHistoryRow[]>([]);
  const [signingOut, setSigningOut] = useState(false);
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<
    Array<{ id: string; title: string | null; body: string | null; created_at: string | null; read_at: string | null }>
  >([]);

  const navItems = useMemo(
    () =>
      contractorNavItems().map((item) => ({
        ...item,
        label: NAV_LABEL_KEYS[item.id] ? t(NAV_LABEL_KEYS[item.id]) : item.label
      })),
    [t]
  );

  const groupedJobs = useMemo(() => {
    const active: ContractorJobCardModel[] = [];
    const upcoming: ContractorJobCardModel[] = [];
    const completed: ContractorJobCardModel[] = [];

    for (const job of jobCards) {
      const status = normalizedJobStatus(job.status);
      if (status === 'completed' || status === 'complete' || status === 'done') completed.push(job);
      else if (status === 'in_progress' || status === 'started') active.push(job);
      else upcoming.push(job);
    }

    return { active, upcoming, completed };
  }, [jobCards]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    setGateMessage('');

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();
    if (authError || !user) {
      router.push(`/login?next=${encodeURIComponent(CONTRACTOR_HOME_PATH)}`);
      return;
    }
    setUserId(user.id);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, plan, email, full_name, display_name')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) {
      logContractorError('worker_lookup_failed', profileError.message);
      setErrors((current) => [...current, 'worker_lookup_failed']);
    }

    const role = normalizeRole(profile?.role);
    const nextPlan = normalizePlan(profile?.plan);
    setPlan(nextPlan);

    if (!isContractorRole(role) && !limitsForPlan(nextPlan).contractorPortal) {
      setGateMessage(t('portal.contractor.growthRequired'));
      setLoading(false);
      return;
    }

    const org = await ensureOrganizationForUser(user.id);
    const organizationId = org?.organizationId || null;
    const lookupEmail = String(user.email || profile?.email || '').trim().toLowerCase();
    const displayName = String(profile?.full_name || profile?.display_name || '').trim();
    const workerSelect = 'id, auth_user_id, email, active, organization_id, name';

    const queries = [
      supabase.from('workers').select(workerSelect).eq('auth_user_id', user.id),
      lookupEmail
        ? supabase.from('workers').select(workerSelect).ilike('email', lookupEmail)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
      organizationId
        ? supabase.from('workers').select(workerSelect).eq('organization_id', organizationId)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null })
    ] as const;

    const [authWorkersRes, emailWorkersRes, orgWorkersRes] = await Promise.all(queries);
    if (authWorkersRes.error || emailWorkersRes.error || orgWorkersRes.error) {
      const message =
        authWorkersRes.error?.message ||
        emailWorkersRes.error?.message ||
        orgWorkersRes.error?.message ||
        'worker lookup failed';
      logContractorError('worker_lookup_failed', message);
      setErrors((current) => [...current, 'worker_lookup_failed']);
      setLoading(false);
      return;
    }

    const workerMap = new Map<
      string,
      {
        id?: string | null;
        auth_user_id?: string | null;
        email?: string | null;
        name?: string | null;
        active?: boolean | null;
        organization_id?: string | null;
      }
    >();
    for (const row of [...(authWorkersRes.data || []), ...(emailWorkersRes.data || []), ...(orgWorkersRes.data || [])]) {
      workerMap.set(String(row.id), row);
    }

    const workerRows = Array.from(workerMap.values());
    const identity = contractorIdentityFromWorkers(user.id, workerRows, lookupEmail, displayName);
    const workerIds = identity.workerIds || [];

    if (!workerIds.length) {
      logContractorError(
        'worker_not_linked',
        JSON.stringify({ organizationId, lookupEmail, displayName, visibleWorkerCount: workerRows.length })
      );
      setErrors(['worker_not_linked']);
      setMetrics(EMPTY_METRICS);
      setJobCards([]);
      setHistory([]);
      setLoading(false);
      return;
    }

    const jobSelect =
      'id, title, status, due_date, start_date, scheduled_start, address, customer_name, user_id, assigned_to, organization_id, completed_at, created_at';

    const [assignmentRes, directJobsRes, laborRes] = await Promise.all([
      supabase.from('job_assignments').select('job_id, worker_id').in('worker_id', workerIds),
      organizationId
        ? supabase
            .from('jobs')
            .select(jobSelect)
            .eq('organization_id', organizationId)
            .or(`assigned_to.in.(${workerIds.join(',')}),assigned_to.eq.${user.id}`)
        : supabase
            .from('jobs')
            .select(jobSelect)
            .or(`assigned_to.in.(${workerIds.join(',')}),assigned_to.eq.${user.id}`),
      supabase
        .from('job_labor')
        .select('id, job_id, worker_id, total_cost, payment_status, paid_at, created_at, organization_id')
        .in('worker_id', workerIds)
    ]);

    const nextErrors: ContractorLoadErrorCode[] = [];
    if (assignmentRes.error) {
      logContractorError('assignment_query_failed', assignmentRes.error.message);
      nextErrors.push('assignment_query_failed');
    }
    if (directJobsRes.error) {
      const code = /permission|rls|policy/i.test(directJobsRes.error.message) ? 'access_blocked' : 'jobs_query_failed';
      logContractorError(code, directJobsRes.error.message);
      nextErrors.push(code);
    }
    if (laborRes.error) {
      const code = /permission|rls|policy/i.test(laborRes.error.message) ? 'access_blocked' : 'earnings_query_failed';
      logContractorError(code, laborRes.error.message);
      nextErrors.push(code);
      if (code === 'earnings_query_failed') nextErrors.push('payment_query_failed');
    }

    const assignmentWorkerIdsByJob = buildAssignmentWorkerIdsByJob(assignmentRes.data || []);
    const assignmentJobIds = Array.from(
      new Set(
        (assignmentRes.data || [])
          .map((row: { job_id?: string | null }) => String(row.job_id || ''))
          .filter(Boolean)
      )
    );

    let assignmentJobs: ContractorJobRow[] = [];
    if (assignmentJobIds.length) {
      const { data: assignedJobs, error: assignedJobsError } = await supabase
        .from('jobs')
        .select(jobSelect)
        .in('id', assignmentJobIds);
      if (assignedJobsError) {
        logContractorError('jobs_query_failed', assignedJobsError.message);
        nextErrors.push('jobs_query_failed');
      } else {
        assignmentJobs = (assignedJobs || []) as ContractorJobRow[];
      }
    }

    const mergedJobs = new Map<string, ContractorJobRow>();
    for (const job of [...assignmentJobs, ...((directJobsRes.data || []) as ContractorJobRow[])]) mergedJobs.set(job.id, job);

    const laborRows = (laborRes.data || []) as ContractorLaborRow[];
    const missingJobIds = Array.from(
      new Set(laborRows.map((row) => String(row.job_id || '')).filter((id) => id && !mergedJobs.has(id)))
    );

    if (missingJobIds.length) {
      const { data: laborJobs, error: laborJobsError } = await supabase
        .from('jobs')
        .select(jobSelect)
        .in('id', missingJobIds);
      if (laborJobsError) {
        logContractorError('jobs_query_failed', laborJobsError.message);
        nextErrors.push('jobs_query_failed');
      } else {
        for (const job of (laborJobs || []) as ContractorJobRow[]) mergedJobs.set(job.id, job);
      }
    }

    const jobsForView = Array.from(mergedJobs.values());
    const jobsById = new Map(jobsForView.map((job) => [job.id, job]));

    setMetrics(computeContractorDashboardMetrics(jobsForView, laborRows, identity, undefined, assignmentWorkerIdsByJob));
    setJobCards(buildContractorJobCards(jobsForView, laborRows, identity, assignmentWorkerIdsByJob));
    setHistory(buildContractorPaymentHistory(laborRows, jobsById, workerIds));

    const { data: notificationRows } = await supabase
      .from('notifications')
      .select('id, title, body, created_at, read_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(12);
    setNotifications(
      (notificationRows || []).filter(
        (item: { title?: string | null; body?: string | null }) => !isLegacyContractorShareNotification(item)
      )
    );

    setErrors(Array.from(new Set(nextErrors)));
    setLoading(false);
  }, [router, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(jobId: string, status: string) {
    const { error } = await supabase.from('jobs').update({ status }).eq('id', jobId);
    if (error) {
      logContractorError('jobs_query_failed', error.message);
      setErrors((current) => Array.from(new Set<ContractorLoadErrorCode>([...current, 'jobs_query_failed'])));
      return;
    }
    await load();
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await performClientLogout();
      window.location.assign('/login');
    } catch {
      router.push('/login');
      setSigningOut(false);
    }
  }

  function renderJobCard(job: ContractorJobCardModel) {
    const expanded = openJobId === job.id;
    const status = normalizedJobStatus(job.status);
    const completed = status === 'completed' || status === 'complete' || status === 'done';

    return (
      <article
        key={job.id}
        className="contractor-job-card"
        style={{ marginTop: 12, border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}
      >
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`contractor-job-${job.id}`}
          onClick={() => setOpenJobId(expanded ? null : job.id)}
          style={{ width: '100%', border: 0, background: 'transparent', color: 'inherit', padding: 16, textAlign: 'left', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: 17, margin: 0 }}>{job.title}</h3>
              <p className="muted" style={{ margin: '5px 0 0' }}>
                {job.customerName} · {job.date || t('portal.common.dateNotSet')}
              </p>
              <p className="muted" style={{ margin: '4px 0 0' }}>{job.address}</p>
            </div>
            <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>{expanded ? '−' : '+'}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            <span className="badge">{translatePortalJobStatus(t, job.status)}</span>
            {job.paymentStatus !== 'none' ? (
              <>
                <span className="badge">{t('portal.contractor.pay')}: {formatContractorMoney(job.payAmount)}</span>
                <span className="badge">
                  {t('portal.contractor.payment')}: {translatePortalPaymentStatus(t, job.paymentStatus)}
                </span>
              </>
            ) : null}
          </div>
        </button>

        {expanded ? (
          <div id={`contractor-job-${job.id}`} style={{ padding: '0 16px 16px', borderTop: '1px solid var(--line)' }}>
            <div className="inline-actions" style={{ marginTop: 14, flexWrap: 'wrap' }}>
              {!completed && status !== 'in_progress' ? (
                <button type="button" className="btn btn-primary" onClick={() => void updateStatus(job.id, 'in_progress')}>
                  {t('portal.contractor.startJob')}
                </button>
              ) : null}
              {!completed ? (
                <button type="button" className="btn" onClick={() => void updateStatus(job.id, 'completed')}>
                  {t('portal.contractor.markComplete')}
                </button>
              ) : null}
              <Link className="btn" href={contractorJobDetailPath(job.id)}>{t('portal.contractor.openDetails')}</Link>
              {(() => {
                const event = contractorJobCalendarEvent(job);
                if (!event) return null;
                return (
                  <>
                    <a className="btn" href={googleCalendarEventUrl(event)} target="_blank" rel="noreferrer">
                      {t('portal.contractor.googleCalendar')}
                    </a>
                    <a className="btn" href={outlookCalendarEventUrl(event)} target="_blank" rel="noreferrer">
                      {t('portal.contractor.outlook')}
                    </a>
                    <button type="button" className="btn" onClick={() => downloadCalendarIcs(event)}>
                      {t('portal.contractor.appleIcs')}
                    </button>
                  </>
                );
              })()}
            </div>

            {photoUploadAllowed(plan) && userId ? (
              <div style={{ marginTop: 14 }}>
                <h4 style={{ fontSize: 15, marginBottom: 8 }}>{t('portal.contractor.jobPhotos')}</h4>
                <PhotoUpload jobId={job.id} userId={job.userId || userId} disabled={completed} />
              </div>
            ) : null}
          </div>
        ) : null}
      </article>
    );
  }

  const hasDataError = errors.length > 0;
  const today = localToday();
  const todaysJobs = [...groupedJobs.active, ...groupedJobs.upcoming].filter(
    (job) => String(job.date || '').slice(0, 10) === today
  );
  const upcomingOnly = groupedJobs.upcoming.filter((job) => String(job.date || '').slice(0, 10) !== today);
  const completedJobs = groupedJobs.completed
    .slice()
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  return (
    <AuthenticatedSection role="contractor" className="contractor-dashboard">
      <header id="overview" className="contractor-dash-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <h1>{t('portal.contractor.today')}</h1>
        <div style={{ width: 'min(100%, 9rem)' }}>
          <LanguageSwitcher id="contractor-portal-language" variant="compact" />
        </div>
      </header>

      <nav className="contractor-dash-nav" aria-label={t('portal.contractor.portal')}>
        {navItems.map((item) => <Link key={item.id} href={item.href} className="btn">{item.label}</Link>)}
        <button type="button" className="btn" onClick={() => void signOut()} disabled={signingOut} aria-busy={signingOut}>
          {signingOut ? t('portal.common.signingOut') : t('portal.common.signOut')}
        </button>
      </nav>

      {loading ? <div className="card">{t('portal.contractor.loading')}</div> : null}
      {gateMessage ? <div className="card">{gateMessage}</div> : null}

      {!loading && !gateMessage ? (
        <>
          {hasDataError ? (
            <div className="card" role="alert" style={{ borderColor: 'var(--danger)', marginBottom: 16 }}>
              <h2 style={{ fontSize: 17 }}>{t('portal.contractor.loadErrorTitle')}</h2>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {errors.map((code) => <li key={code}>{errorMessage(code, t)}</li>)}
              </ul>
              <button type="button" className="btn" style={{ marginTop: 12 }} onClick={() => void load()}>
                {t('portal.contractor.tryAgain')}
              </button>
            </div>
          ) : null}

          <section id="jobs" className="card" aria-label={t('portal.contractor.todaysJobs')} style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>{t('portal.contractor.todaysJobs')}</h2>
            {todaysJobs.length === 0 && groupedJobs.active.length === 0 ? (
              <p className="muted" style={{ marginTop: 12 }}>{t('portal.contractor.nothingToday')}</p>
            ) : (
              <div style={{ marginTop: 8 }}>{(todaysJobs.length ? todaysJobs : groupedJobs.active).map(renderJobCard)}</div>
            )}
          </section>

          <details id="schedule" className="card" open style={{ marginBottom: 16 }}>
            <summary
              style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}
            >
              <h2 style={{ fontSize: 18, margin: 0 }}>{t('portal.contractor.upcomingJobs')}</h2>
              <span className="muted">{upcomingOnly.length}</span>
            </summary>
            {upcomingOnly.length === 0 ? (
              <p className="muted" style={{ marginTop: 12 }}>{t('portal.contractor.noUpcoming')}</p>
            ) : (
              <div style={{ marginTop: 8 }}>
                {upcomingOnly.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))).map(renderJobCard)}
              </div>
            )}
          </details>

          <details id="past-jobs" className="card" style={{ marginBottom: 16 }}>
            <summary
              style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}
            >
              <h2 style={{ fontSize: 18, margin: 0 }}>{t('portal.contractor.pastJobs')}</h2>
              <span className="muted">{metrics.completedJobs} {t('portal.contractor.completed')}</span>
            </summary>
            {completedJobs.length === 0 ? (
              <p className="muted" style={{ marginTop: 12 }}>{t('portal.contractor.noCompleted')}</p>
            ) : (
              <div style={{ marginTop: 8 }}>{completedJobs.map(renderJobCard)}</div>
            )}
          </details>

          <section id="earnings" className="card" aria-label={t('portal.contractor.earnings')} style={{ marginBottom: 16 }}>
            <div className="dashboard-section-head">
              <div>
                <h2 style={{ fontSize: 18 }}>{t('portal.contractor.earnings')}</h2>
                <p className="muted" style={{ marginTop: 4 }}>
                  {metrics.completedJobs} {earningsCopy.completedWork}. {earningsCopy.keepGoing}
                </p>
              </div>
              {history.length > 0 ? (
                <strong>{earningsCopy.paidToYou}: {formatContractorMoney(metrics.paidEarnings)}</strong>
              ) : null}
            </div>

            {history.length === 0 && !hasDataError ? (
              <p className="muted" style={{ marginTop: 12 }}>{earningsCopy.paymentRecordsPending}</p>
            ) : null}

            {history.length > 0 ? (
              <div className="table-wrap" style={{ overflowX: 'auto', marginTop: 12 }}>
                <table className="table data-table">
                  <thead>
                    <tr>
                      <th>{t('portal.contractor.job')}</th>
                      <th>{t('portal.contractor.customer')}</th>
                      <th>{t('portal.contractor.workDate')}</th>
                      <th>{t('portal.contractor.earned')}</th>
                      <th>{t('portal.common.status')}</th>
                      <th>{t('portal.contractor.paidDate')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.laborId}>
                        <td>{row.jobId ? <Link href={contractorJobDetailPath(row.jobId)}>{row.jobTitle}</Link> : row.jobTitle}</td>
                        <td>{row.customerName}</td>
                        <td>{row.workDate || '—'}</td>
                        <td>{formatContractorMoney(row.amountEarned)}</td>
                        <td>{translatePortalPaymentStatus(t, row.paymentStatus)}</td>
                        <td>{row.paidDate || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <section id="notifications" className="card" aria-label={t('portal.contractor.notifications')} style={{ marginBottom: 16 }}>
            <div className="dashboard-section-head">
              <h2 style={{ fontSize: 18 }}>{t('portal.contractor.notifications')}</h2>
              <Link href={CONTRACTOR_SETTINGS_PATH} className="dashboard-section-link">{t('portal.contractor.preferences')}</Link>
            </div>
            {notifications.length === 0 ? (
              <p className="muted">{t('portal.contractor.noNotifications')}</p>
            ) : (
              notifications.map((item) => (
                <div key={item.id} className="list-row">
                  <div>
                    {item.title ? <strong>{item.title}</strong> : null}
                    {item.body ? <p className="muted">{item.body}</p> : null}
                  </div>
                  <span className="muted">
                    {item.created_at ? new Date(item.created_at).toLocaleString(locale) : ''}
                    {item.read_at ? '' : ` · ${t('portal.contractor.unread')}`}
                  </span>
                </div>
              ))
            )}
          </section>

          <section className="card" aria-label={t('portal.legal.title')}>
            <h2 style={{ fontSize: 18 }}>{t('portal.legal.title')}</h2>
            <p className="muted">{t('portal.legal.description')}</p>
            <div className="button-row" style={{ marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
              <Link className="btn" href="/privacy">{t('portal.legal.privacy')}</Link>
              <Link className="btn" href="/terms">{t('portal.legal.terms')}</Link>
              <Link className="btn" href="/disclaimer/contractor">{t('portal.legal.contractorDisclaimer')}</Link>
              <Link className="btn" href={CONTRACTOR_SETTINGS_PATH}>{t('portal.contractor.settingsTitle')}</Link>
            </div>
          </section>
        </>
      ) : null}
    </AuthenticatedSection>
  );
}
