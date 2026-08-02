'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { ExportMenu } from '@/components/export-menu';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useTranslation } from '@/components/locale-provider';
import { PhotoUpload } from '@/components/photo-upload';
import { getExportCopy } from '@/lib/i18n/export-copy';
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
import {
  contractorJobCalendarEvent,
  downloadCalendarIcs,
  googleCalendarEventUrl,
  outlookCalendarEventUrl
} from '@/lib/calendar-links';
import { performClientLogout } from '@/lib/client-logout';
import { translatePortalJobStatus, translatePortalPaymentStatus } from '@/lib/portal-status-i18n';
import { isContractorRole, normalizeRole } from '@/lib/roles';
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
  paymentRecordsPending: string;
  paidToYou: string;
};

const EARNINGS_COPY: Record<'en' | 'es' | 'vi', EarningsCopy> = {
  en: {
    completedWork: 'jobs completed',
    paymentRecordsPending: 'No earnings available yet.',
    paidToYou: 'Paid to you'
  },
  es: {
    completedWork: 'trabajos completados',
    paymentRecordsPending: 'Aún no hay ganancias disponibles.',
    paidToYou: 'Pagado a ti'
  },
  vi: {
    completedWork: 'công việc đã hoàn thành',
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
  const exportCopy = getExportCopy(locale);
  const [plan, setPlan] = useState(normalizePlan('free'));
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [exportError, setExportError] = useState('');
  const [gateMessage, setGateMessage] = useState('');
  const [errors, setErrors] = useState<ContractorLoadErrorCode[]>([]);
  const [metrics, setMetrics] = useState<ContractorDashboardMetrics>(EMPTY_METRICS);
  const [jobCards, setJobCards] = useState<ContractorJobCardModel[]>([]);
  const [history, setHistory] = useState<ContractorPaymentHistoryRow[]>([]);
  const [signingOut, setSigningOut] = useState(false);
  const [openJobId, setOpenJobId] = useState<string | null>(null);

  const navItems = useMemo(
    () =>
      contractorNavItems().map((item) => ({
        ...item,
        label: NAV_LABEL_KEYS[item.id] ? t(NAV_LABEL_KEYS[item.id]) : item.label
      })),
    [t]
  );

  const groupedJobs = useMemo(() => {
    const current: ContractorJobCardModel[] = [];
    const completed: ContractorJobCardModel[] = [];

    for (const job of jobCards) {
      const status = normalizedJobStatus(job.status);
      if (status === 'completed' || status === 'complete' || status === 'done') completed.push(job);
      else current.push(job);
    }

    current.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    completed.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    return { current, completed };
  }, [jobCards]);

  const jobCardsById = useMemo(() => new Map(jobCards.map((job) => [job.id, job])), [jobCards]);

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

  function renderField(label: string, value: string) {
    return (
      <div>
        <dt className="muted" style={{ fontSize: 12, fontWeight: 700 }}>{label}</dt>
        <dd style={{ margin: '5px 0 0' }}>{value || '—'}</dd>
      </div>
    );
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
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <p className="eyebrow" style={{ margin: 0 }}>{t('portal.contractor.job')}</p>
              <h3 style={{ fontSize: 17, margin: '5px 0 0' }}>{job.title}</h3>
            </div>
            {job.payAmount > 0 ? <strong style={{ fontSize: 18 }}>{formatContractorMoney(job.payAmount)}</strong> : null}
          </div>
          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, margin: '16px 0 0' }}>
            {renderField(t('portal.contractor.workDate'), job.date || 'Not set')}
            {renderField('Address', job.address || 'Not set')}
            {renderField(t('portal.contractor.customer'), job.customerName || 'Not set')}
            {renderField(t('portal.common.status'), translatePortalJobStatus(t, job.status))}
            {job.payAmount > 0 ? renderField(t('portal.contractor.payment'), translatePortalPaymentStatus(t, job.paymentStatus)) : null}
          </dl>
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

  return (
    <AuthenticatedSection role="contractor" className="contractor-dashboard">
      <header id="overview" className="contractor-dash-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <h1>{t('portal.contractor.today')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <ExportMenu
            endpoint="/api/exports/portal/contractor/jobs"
            locale={locale}
            labels={{
              export: exportCopy.downloadMyJobs,
              csv: exportCopy.downloadMyJobsCsv,
              pdf: exportCopy.downloadMyJobsPdf
            }}
            disabled={loading}
            onError={(err) => setExportError(err || exportCopy.exportFailed)}
            onSuccess={() => setExportError('')}
          />
          <div style={{ width: 'min(100%, 9rem)' }}>
            <LanguageSwitcher id="contractor-portal-language" variant="compact" />
          </div>
        </div>
      </header>
      {exportError ? <p className="auth-message auth-message-error">{exportError}</p> : null}

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

          <details id="current-jobs" className="card" style={{ marginBottom: 16 }} open>
            <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <h2 style={{ fontSize: 18, margin: 0 }}>Current Jobs</h2>
              <span className="muted">{groupedJobs.current.length}</span>
            </summary>
            {groupedJobs.current.length === 0 ? (
              <p className="muted" style={{ marginTop: 12 }}>{t('portal.contractor.noUpcoming')}</p>
            ) : (
              <div style={{ marginTop: 8 }}>{groupedJobs.current.map(renderJobCard)}</div>
            )}
          </details>

          <details id="history" className="card" style={{ marginBottom: 16 }} open>
            <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontSize: 18, margin: 0 }}>Past Jobs</h2>
                <span className="muted">{metrics.completedJobs} {earningsCopy.completedWork}</span>
              </div>
              {history.length > 0 ? <strong>{earningsCopy.paidToYou}: {formatContractorMoney(metrics.paidEarnings)}</strong> : null}
            </summary>

            {history.length === 0 && !hasDataError ? (
              <p className="muted" style={{ marginTop: 16 }}>{earningsCopy.paymentRecordsPending}</p>
            ) : null}

            {history.length > 0 ? (
              <div className="contractor-history-list" style={{ display: 'grid', gap: 12, marginTop: 18 }}>
                {history.map((row) => {
                  const job = row.jobId ? jobCardsById.get(row.jobId) : undefined;
                  return (
                    <article key={row.laborId} className="contractor-history-card" style={{ border: '1px solid var(--line)', borderRadius: 16, padding: 18, background: 'var(--surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0 }}>
                          <p className="eyebrow" style={{ margin: 0 }}>{t('portal.contractor.job')}</p>
                          <h3 style={{ margin: '5px 0 0', fontSize: 17 }}>{row.jobTitle}</h3>
                        </div>
                        <strong style={{ fontSize: 18 }}>{formatContractorMoney(row.amountEarned)}</strong>
                      </div>
                      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, margin: '16px 0 0' }}>
                        {renderField(t('portal.contractor.workDate'), row.workDate || 'Not set')}
                        {renderField('Address', job?.address || 'Not set')}
                        {renderField(t('portal.contractor.customer'), row.customerName || 'Not set')}
                        {renderField(t('portal.common.status'), translatePortalPaymentStatus(t, row.paymentStatus))}
                        {renderField(t('portal.contractor.paidDate'), row.paidDate || 'Not set')}
                      </dl>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </details>

          <section className="card" aria-label={t('portal.legal.title')}>
            <h2 style={{ fontSize: 18 }}>{t('portal.legal.title')}</h2>
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
