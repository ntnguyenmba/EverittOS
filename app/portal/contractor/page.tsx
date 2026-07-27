'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthenticatedSection } from '@/components/authenticated-section';
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

function logContractorError(code: ContractorLoadErrorCode, detail: string) {
  if (code === 'worker_not_linked' || process.env.NODE_ENV !== 'production') {
    console.error(`[contractor-dashboard] ${code}: ${detail}`);
  }
}

function errorMessage(code: ContractorLoadErrorCode): string {
  switch (code) {
    case 'worker_not_linked':
      return 'Your contractor account is not linked to a worker profile yet. Ask your workspace owner to assign you on a job.';
    case 'worker_lookup_failed':
      return 'Could not load your worker profile. Refresh and try again.';
    case 'assignment_query_failed':
      return 'Could not load your job assignments.';
    case 'jobs_query_failed':
      return 'Could not load your assigned jobs.';
    case 'earnings_query_failed':
    case 'payment_query_failed':
      return 'Could not load your contractor pay records.';
    case 'access_blocked':
      return 'Access to contractor pay or jobs was blocked. Contact your workspace owner.';
    default:
      return 'Something went wrong loading your contractor dashboard.';
  }
}

function normalizedJobStatus(status: string) {
  return String(status || '').trim().toLowerCase().replace(/\s+/g, '_');
}

export default function ContractorPortalPage() {
  const router = useRouter();
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

  const navItems = useMemo(() => contractorNavItems(), []);

  const groupedJobs = useMemo(() => {
    const active: ContractorJobCardModel[] = [];
    const upcoming: ContractorJobCardModel[] = [];
    const completed: ContractorJobCardModel[] = [];

    for (const job of jobCards) {
      const status = normalizedJobStatus(job.status);
      if (status === 'completed' || status === 'complete' || status === 'done') {
        completed.push(job);
      } else if (status === 'in_progress' || status === 'started') {
        active.push(job);
      } else {
        upcoming.push(job);
      }
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
      setGateMessage('Contractor portal requires Growth plan or a contractor role.');
      setLoading(false);
      return;
    }

    const org = await ensureOrganizationForUser(user.id);
    const organizationId = org?.organizationId || null;
    const lookupEmail = String(user.email || profile?.email || '')
      .trim()
      .toLowerCase();
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
    for (const row of [
      ...(authWorkersRes.data || []),
      ...(emailWorkersRes.data || []),
      ...(orgWorkersRes.data || [])
    ]) {
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
      const code = /permission|rls|policy/i.test(directJobsRes.error.message)
        ? 'access_blocked'
        : 'jobs_query_failed';
      logContractorError(code, directJobsRes.error.message);
      nextErrors.push(code);
    }
    if (laborRes.error) {
      const code = /permission|rls|policy/i.test(laborRes.error.message)
        ? 'access_blocked'
        : 'earnings_query_failed';
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
    for (const job of [...assignmentJobs, ...((directJobsRes.data || []) as ContractorJobRow[])]) {
      mergedJobs.set(job.id, job);
    }

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

    setMetrics(
      computeContractorDashboardMetrics(jobsForView, laborRows, identity, undefined, assignmentWorkerIdsByJob)
    );
    setJobCards(buildContractorJobCards(jobsForView, laborRows, identity, assignmentWorkerIdsByJob));
    setHistory(buildContractorPaymentHistory(laborRows, jobsById, workerIds));
    setErrors(Array.from(new Set(nextErrors)));
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(jobId: string, status: string) {
    const { error } = await supabase.from('jobs').update({ status }).eq('id', jobId);
    if (error) {
      logContractorError('jobs_query_failed', error.message);
      setErrors((current) =>
        Array.from(new Set<ContractorLoadErrorCode>([...current, 'jobs_query_failed']))
      );
      return;
    }
    await load();
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch('/api/auth/sign-out', { method: 'POST', keepalive: true });
      await supabase.auth.signOut();
    } finally {
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
          style={{
            width: '100%',
            border: 0,
            background: 'transparent',
            color: 'inherit',
            padding: 16,
            textAlign: 'left',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: 17, margin: 0 }}>{job.title}</h3>
              <p className="muted" style={{ margin: '5px 0 0' }}>
                {job.customerName} · {job.date || 'Date not set'}
              </p>
              <p className="muted" style={{ margin: '4px 0 0' }}>{job.address}</p>
            </div>
            <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>
              {expanded ? '−' : '+'}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            <span className="badge">{job.status}</span>
            <span className="badge">
              Pay: {job.paymentStatus === 'none' ? 'Not set' : formatContractorMoney(job.payAmount)}
            </span>
          </div>
        </button>

        {expanded ? (
          <div id={`contractor-job-${job.id}`} style={{ padding: '0 16px 16px', borderTop: '1px solid var(--line)' }}>
            <div className="inline-actions" style={{ marginTop: 14 }}>
              {!completed && status !== 'in_progress' ? (
                <button type="button" className="btn btn-primary" onClick={() => void updateStatus(job.id, 'in_progress')}>
                  Start job
                </button>
              ) : null}
              {!completed ? (
                <button type="button" className="btn" onClick={() => void updateStatus(job.id, 'completed')}>
                  Mark complete
                </button>
              ) : null}
              <Link className="btn" href={`/jobs/${job.id}`}>
                Open details
              </Link>
            </div>

            {photoUploadAllowed(plan) && userId ? (
              <div style={{ marginTop: 14 }}>
                <h4 style={{ fontSize: 15, marginBottom: 8 }}>Job photos</h4>
                <PhotoUpload jobId={job.id} userId={job.userId || userId} disabled={false} />
              </div>
            ) : null}
          </div>
        ) : null}
      </article>
    );
  }

  const hasDataError = errors.length > 0;
  const emptyJobs = !loading && !hasDataError && jobCards.length === 0 && !errors.includes('worker_not_linked');
  const emptyEarnings = !loading && !hasDataError && history.length === 0 && !errors.includes('worker_not_linked');

  return (
    <AuthenticatedSection role="contractor" className="contractor-dashboard">
      <header id="overview" className="contractor-dash-header">
        <div>
          <p className="muted" style={{ marginBottom: 4 }}>Contractor workspace</p>
          <h1>My dashboard</h1>
          <p className="muted">Your assigned jobs and pay.</p>
        </div>
      </header>

      <nav className="contractor-dash-nav" aria-label="Contractor">
        {navItems.map((item) => (
          <Link key={item.id} href={item.href} className="btn">{item.label}</Link>
        ))}
        <button type="button" className="btn" onClick={() => void signOut()} disabled={signingOut}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </nav>

      {loading ? <div className="card">Loading your contractor dashboard…</div> : null}
      {gateMessage ? <div className="card">{gateMessage}</div> : null}

      {!loading && !gateMessage ? (
        <>
          {hasDataError ? (
            <div className="card" role="alert" style={{ borderColor: 'var(--danger)', marginBottom: 16 }}>
              <h2 style={{ fontSize: 17 }}>Could not load everything</h2>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {errors.map((code) => <li key={code}>{errorMessage(code)}</li>)}
              </ul>
              {process.env.NODE_ENV !== 'production' ? (
                <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>Dev detail codes: {errors.join(', ')}</p>
              ) : null}
              <button type="button" className="btn" style={{ marginTop: 12 }} onClick={() => void load()}>Try again</button>
            </div>
          ) : null}

          <section className="card" aria-label="Contractor overview" style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Overview</h2>
            <div className="stats-grid">
              <div className="stat-card"><span>Assigned jobs</span><strong>{metrics.assignedJobs}</strong></div>
              <div className="stat-card"><span>Upcoming jobs</span><strong>{metrics.upcomingJobs}</strong></div>
              <div className="stat-card"><span>Paid</span><strong>{formatContractorMoney(metrics.paidEarnings)}</strong></div>
              <div className="stat-card"><span>Still owed</span><strong>{formatContractorMoney(metrics.owedEarnings)}</strong></div>
            </div>
          </section>

          <section id="jobs" className="card" aria-label="Assigned jobs" style={{ marginBottom: 16 }}>
            <div className="dashboard-section-head">
              <h2 style={{ fontSize: 18 }}>My jobs</h2>
              <Link href={`${CONTRACTOR_HOME_PATH}#earnings`} className="dashboard-section-link">View pay</Link>
            </div>

            {emptyJobs ? <p className="muted">No assigned jobs yet.</p> : null}

            {groupedJobs.active.length ? (
              <div style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: 15 }}>Active ({groupedJobs.active.length})</h3>
                {groupedJobs.active.map(renderJobCard)}
              </div>
            ) : null}

            {groupedJobs.upcoming.length ? (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: 15 }}>Upcoming ({groupedJobs.upcoming.length})</h3>
                {groupedJobs.upcoming.map(renderJobCard)}
              </div>
            ) : null}

            {groupedJobs.completed.length ? (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: 15 }}>Completed ({groupedJobs.completed.length})</h3>
                {groupedJobs.completed.map(renderJobCard)}
              </div>
            ) : null}
          </section>

          <section id="earnings" className="card" aria-label="Contractor pay">
            <div className="dashboard-section-head">
              <h2 style={{ fontSize: 18 }}>My pay</h2>
              <Link href={CONTRACTOR_SETTINGS_PATH} className="dashboard-section-link">Profile</Link>
            </div>
            {emptyEarnings ? <p className="muted">No pay records yet.</p> : null}
            {history.length ? (
              <div className="table-wrap" style={{ overflowX: 'auto', marginTop: 12 }}>
                <table className="table data-table">
                  <thead>
                    <tr><th>Job</th><th>Customer</th><th>Work date</th><th>Earned</th><th>Paid</th><th>Outstanding</th><th>Status</th><th>Paid date</th></tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.laborId}>
                        <td>{row.jobId ? <Link href={`/jobs/${row.jobId}`}>{row.jobTitle}</Link> : row.jobTitle}</td>
                        <td>{row.customerName}</td>
                        <td>{row.workDate || '—'}</td>
                        <td>{formatContractorMoney(row.amountEarned)}</td>
                        <td>{formatContractorMoney(row.amountPaid)}</td>
                        <td>{formatContractorMoney(row.outstandingAmount)}</td>
                        <td>{row.paymentStatus}</td>
                        <td>{row.paidDate || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </AuthenticatedSection>
  );
}
