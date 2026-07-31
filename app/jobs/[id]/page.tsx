'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { JobChecklist } from '@/components/job-checklist';
import { ClientAccessPanel } from '@/components/client-access-panel';
import { JobWorkflow } from '@/components/job-workflow';
import { JobPhotosSection } from '@/components/job-photos-section';
import { JobLaborSection } from '@/components/job-labor-section';
import { JobProfitabilityCard } from '@/components/job-profitability-card';
import { CustomerReportSharePanel } from '@/components/customer-report-share-panel';
import { JobVisitsSchedule } from '@/components/job-visits-schedule';
import { JobAssignments } from '@/components/job-assignments';
import { JobAddToCalendar } from '@/components/job-add-to-calendar';
import { RecordSharingPanel } from '@/components/record-sharing-panel';
import { AddressAutocomplete } from '@/components/address-autocomplete';
import { AppShell } from '@/components/app-shell';
import { canAccessFinancials } from '@/lib/finance-access';
import { fetchOrganizationContext } from '@/lib/organization';
import { createNotification } from '@/lib/activity';
import { StatusPill } from '@/components/status-pill';
import { canAccessFeature } from '@/lib/plan-access';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchUsageCounts, reportLimitReached, limitMessage } from '@/lib/everittos-usage';
import { hasPermission } from '@/lib/permissions';
import { canViewInternalNotes, isContractorRole, isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { getBillingOpsCopy } from '@/lib/i18n/billing-ops-copy';
import { canAccessWorkspaceRecord } from '@/lib/workspace-record-access';
import { contractorIdentityFromWorkers } from '@/lib/contractor-dashboard';
import { contractorJobDetailPath } from '@/lib/contractor-job-access';
import { workerIdentityAliases } from '@/lib/worker-assignment';
import { formatSupabaseError } from '@/lib/action-messages';
import { FEEDBACK } from '@/lib/feedback-labels';
import { getJobDetailCopy } from '@/lib/i18n/job-detail-copy';
import { supabase } from '@/lib/supabase';

type PageProps = { params: Promise<{ id: string }> };

type Job = {
  id: string;
  user_id: string;
  title: string;
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: string | null;
  start_date: string | null;
  due_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  assigned_to: string | null;
  assigned_email: string | null;
  organization_id: string | null;
  customer_id: string | null;
  customer_email?: string | null;
  recurring_series_id?: string | null;
  occurrence_date?: string | null;
  is_skipped?: boolean | null;
  revenue_amount?: number | null;
  expected_contractor_cost?: number | null;
  expected_additional_expense?: number | null;
  timezone?: string | null;
  priority: string | null;
  internal_notes: string | null;
  customer_notes: string | null;
  completion_verified: boolean | null;
  created_at: string | null;
};

type Worker = { id: string; name: string };
type Assignment = { id: string; worker_id: string; responsibility: string | null };

const SAFE_JOB_DETAIL_COLUMNS = [
  'id',
  'user_id',
  'title',
  'customer_name',
  'phone',
  'address',
  'notes',
  'status',
  'start_date',
  'due_date',
  'scheduled_start',
  'scheduled_end',
  'assigned_to',
  'assigned_email',
  'organization_id',
  'customer_id',
  'customer_email',
  'recurring_series_id',
  'occurrence_date',
  'is_skipped',
  'revenue_amount',
  'expected_contractor_cost',
  'expected_additional_expense',
  'timezone',
  'priority',
  'customer_notes',
  'completion_verified',
  'created_at'
];

function jobDetailColumns(canReadInternalNotes: boolean): string {
  return [...SAFE_JOB_DETAIL_COLUMNS, ...(canReadInternalNotes ? ['internal_notes'] : [])].join(', ');
}

function displayValue(value: string | null | undefined, fallback: string) {
  return value && value.trim() ? value : fallback;
}

function formatPriority(value: string | null, labels: { low: string; normal: string; high: string; urgent: string }) {
  if (value === 'low') return labels.low;
  if (value === 'high') return labels.high;
  if (value === 'urgent') return labels.urgent;
  return labels.normal;
}

function formatDateTime(value: string | null, fallback: string) {
  if (!value) return fallback;
  return new Date(value).toLocaleString();
}

function isActiveStatus(status: string | null | undefined) {
  return status === 'active' || status === 'in_progress';
}

export default function JobDetailPage({ params }: PageProps) {
  const router = useRouter();
  const [confirmSchedule, setConfirmSchedule] = useState(false);
  const [jobId, setJobId] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [checklist, setChecklist] = useState<{ id: string; label: string; completed: boolean; sort_order: number }[]>([]);
  const [orgId, setOrgId] = useState('');
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [userRole, setUserRole] = useState<UserRole>('owner');
  const [canManage, setCanManage] = useState(false);
  const [canEditStatus, setCanEditStatus] = useState(false);
  const [canUploadPhotos, setCanUploadPhotos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creatingReport, setCreatingReport] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [seriesBusy, setSeriesBusy] = useState('');
  const [photoRefresh, setPhotoRefresh] = useState(0);
  const [financeRefresh, setFinanceRefresh] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [completionPrompt, setCompletionPrompt] = useState(false);
  const appFeedback = useAppFeedback();
  const { t, locale } = useTranslation();
  const copy = getJobDetailCopy(locale);
  const billingCopy = getBillingOpsCopy(locale);

  useEffect(() => {
    params.then((p) => setJobId(p.id));
  }, [params]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setConfirmSchedule(new URLSearchParams(window.location.search).get('confirmSchedule') === '1');
  }, []);

  async function loadJob() {
    if (!jobId) return;
    setLoading(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, role, email, full_name, display_name')
      .eq('id', user.id)
      .maybeSingle();
    const org = await fetchOrganizationContext(user.id);
    const role = normalizeRole(org?.role || profile?.role);
    if (isContractorRole(role)) {
      router.replace(contractorJobDetailPath(jobId));
      return;
    }
    const userPlan = normalizePlan(profile?.plan);
    const canReadInternalNotes = canViewInternalNotes(role);
    setUserRole(role);
    setPlan(userPlan);
    setCanManage(isManagerRole(role));
    setCanEditStatus(hasPermission(role, 'update_status'));
    setCanUploadPhotos(isManagerRole(role) || hasPermission(role, 'upload_before_photos') || hasPermission(role, 'upload_after_photos'));
    if (org) setOrgId(org.organizationId);

    let { data, error } = await supabase.from('jobs').select(jobDetailColumns(canReadInternalNotes)).eq('id', jobId).single();
    if (error && /column|schema cache|does not exist/i.test(error.message || '')) {
      const fallback = await supabase
        .from('jobs')
        .select(
          [...SAFE_JOB_DETAIL_COLUMNS.filter((col) => !['customer_email', 'recurring_series_id', 'occurrence_date', 'is_skipped', 'revenue_amount', 'expected_contractor_cost', 'expected_additional_expense', 'timezone'].includes(col)), ...(canReadInternalNotes ? ['internal_notes'] : [])].join(', ')
        )
        .eq('id', jobId)
        .single();
      data = fallback.data as typeof data;
      error = fallback.error;
    }
    const [{ data: checklistRows }, { data: assignmentRows }] = await Promise.all([
      supabase.from('job_checklist_items').select('id, label, completed, sort_order').eq('job_id', jobId).order('sort_order'),
      supabase.from('job_assignments').select('id, worker_id, responsibility').eq('job_id', jobId)
    ]);
    let typedAssignments = (assignmentRows || []) as Assignment[];
    setChecklist(checklistRows || []);

    if (limitsForPlan(userPlan).crewAssignment) {
      let workersQuery = supabase.from('workers').select('id, name').eq('active', true).order('name');
      workersQuery = org?.organizationId ? workersQuery.eq('organization_id', org.organizationId) : workersQuery.eq('user_id', user.id);
      const { data: crew } = await workersQuery;
      setWorkers(crew || []);
    } else {
      setWorkers([]);
    }

    setLoading(false);
    if (error || !data) {
      const msg = error ? formatSupabaseError(error) : t('pages.jobs.notFound');
      setLoadError(msg);
      appFeedback.error(msg);
      return;
    }

    // Single source of truth: if create saved jobs.assigned_to but missed job_assignments,
    // repair the join row so the detail page never asks to assign again.
    const assignedWorkerId = (data as { assigned_to?: string | null }).assigned_to || null;
    if (
      assignedWorkerId &&
      !typedAssignments.some((row) => row.worker_id === assignedWorkerId) &&
      org?.organizationId &&
      isManagerRole(role)
    ) {
      const { data: repaired } = await supabase
        .from('job_assignments')
        .upsert(
          {
            job_id: jobId,
            worker_id: assignedWorkerId,
            user_id: user.id,
            organization_id: org.organizationId
          },
          { onConflict: 'job_id,worker_id', ignoreDuplicates: false }
        )
        .select('id, worker_id, responsibility')
        .maybeSingle();
      if (repaired) {
        typedAssignments = [...typedAssignments, repaired as Assignment];
      } else {
        typedAssignments = [
          ...typedAssignments,
          { id: `legacy-${assignedWorkerId}`, worker_id: assignedWorkerId, responsibility: null }
        ];
      }
    }
    setAssignments(typedAssignments);

    const lookupEmail = String(user.email || profile?.email || '').trim().toLowerCase();
    const displayName = String(profile?.full_name || profile?.display_name || '').trim();
    const workerSelect = 'id, auth_user_id, email, active, organization_id, name';
    const [authWorkersRes, emailWorkersRes, orgWorkersRes] = await Promise.all([
      supabase.from('workers').select(workerSelect).eq('auth_user_id', user.id),
      lookupEmail
        ? supabase.from('workers').select(workerSelect).ilike('email', lookupEmail)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
      org?.organizationId
        ? supabase.from('workers').select(workerSelect).eq('organization_id', org.organizationId)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null })
    ]);
    const workerMap = new Map<string, Record<string, unknown>>();
    for (const row of [
      ...(authWorkersRes.data || []),
      ...(emailWorkersRes.data || []),
      ...(orgWorkersRes.data || [])
    ]) {
      workerMap.set(String(row.id), row);
    }
    const identity = contractorIdentityFromWorkers(
      user.id,
      Array.from(workerMap.values()),
      lookupEmail,
      displayName
    );
    const identityAliases = workerIdentityAliases(identity);
    const assignedThroughJobAssignments = typedAssignments.some((assignment) =>
      identityAliases.has(String(assignment.worker_id || ''))
    );
    const hasDirectWorkspaceAccess = canAccessWorkspaceRecord(
      data,
      user.id,
      org?.organizationId,
      role,
      data.assigned_to,
      identity.workerIds || []
    );
    const hasAdditionalAssignmentAccess =
      Boolean(org?.organizationId) &&
      data.organization_id === org?.organizationId &&
      assignedThroughJobAssignments;

    if (!hasDirectWorkspaceAccess && !hasAdditionalAssignmentAccess) {
      const msg = t('pages.jobs.notFound');
      setLoadError(msg);
      appFeedback.error(msg);
      return;
    }
    setJob({ ...data, internal_notes: canReadInternalNotes ? data.internal_notes ?? null : null } as Job);
  }

  async function patchJob(fields: Record<string, unknown>, successMessage: string) {
    const res = await fetch(`/api/jobs/${jobId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      appFeedback.error(json.error || copy.unableToSaveJob);
      return false;
    }
    appFeedback.success(successMessage || FEEDBACK.updated);
    return true;
  }

  async function updateStatus(status: string) {
    if (!canEditStatus || updatingStatus) return;
    const isRestoringCancelledJob = job?.status === 'cancelled' && status === 'scheduled';
    const confirmed = status === 'cancelled'
      ? window.confirm('Cancel this job? It will be hidden from dashboard metrics.')
      : isRestoringCancelledJob
        ? window.confirm('Restore this cancelled job? It will become scheduled again.')
        : true;
    if (!confirmed) return;
    setUpdatingStatus(true);
    const ok = await patchJob({ status }, isRestoringCancelledJob ? 'Job restored to scheduled.' : copy.statusUpdated(status));
    setUpdatingStatus(false);
    if (!ok) return;
    if (orgId && status === 'completed') {
      const {
        data: { user: u }
      } = await supabase.auth.getUser();
      if (u) await createNotification(orgId, u.id, 'completion', copy.jobCompletedTitle, job?.title || copy.jobMarkedCompleted, jobId);
      if (canAccessFinancials(userRole, plan) && isManagerRole(userRole)) {
        setCompletionPrompt(true);
      }
    }
    loadJob();
  }

  async function saveJobFields(successMessage: string = FEEDBACK.saved, overrides?: Partial<Job>) {
    if (!job || !canManage || savingDetails) return false;
    const next = { ...job, ...overrides };
    if (!next.title?.trim()) {
      appFeedback.error(copy.jobTitleRequired);
      return false;
    }
    setSavingDetails(true);
    const ok = await patchJob(
      {
        title: next.title.trim(),
        customer_name: next.customer_name,
        customer_email: next.customer_email || null,
        phone: next.phone,
        address: next.address,
        notes: next.notes,
        priority: next.priority,
        internal_notes: next.internal_notes,
        customer_notes: next.customer_notes,
        completion_verified: next.completion_verified
      },
      successMessage
    );
    setSavingDetails(false);
    if (!ok) return false;
    setJob(next);
    loadJob();
    return true;
  }

  async function runSeriesAction(action: 'skip' | 'cancel_visit' | 'pause' | 'resume' | 'end' | 'edit_future' | 'edit_series') {
    if (!job || !canManage || seriesBusy) return;
    setSeriesBusy(action);
    if (action === 'skip' || action === 'cancel_visit') {
      const res = await fetch(`/api/jobs/${job.id}/series-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      setSeriesBusy('');
      if (!res.ok) {
        appFeedback.error(json.error || 'Unable to update this visit.');
        return;
      }
      appFeedback.success(json.message || 'Visit updated.');
      loadJob();
      return;
    }
    if (!job.recurring_series_id) {
      setSeriesBusy('');
      return;
    }

    if (action === 'edit_future' || action === 'edit_series') {
      const scopeLabel =
        action === 'edit_future'
          ? 'this visit and all future uncompleted visits'
          : 'the series defaults and all future uncompleted visits';
      const confirmed = window.confirm(
        `Apply the current title, notes, price, and timezone on this form to ${scopeLabel}? Completed, paid, and historically finalized visits stay unchanged.`
      );
      if (!confirmed) {
        setSeriesBusy('');
        return;
      }
      const res = await fetch(`/api/recurring-jobs/${job.recurring_series_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          fromDate: job.occurrence_date || job.start_date || undefined,
          title: job.title,
          notes: job.notes,
          default_price: job.revenue_amount ?? null,
          expected_contractor_cost: job.expected_contractor_cost ?? null,
          expected_additional_expense: job.expected_additional_expense ?? null,
          timezone: job.timezone || null
        })
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; updatedJobCount?: number };
      setSeriesBusy('');
      if (!res.ok) {
        appFeedback.error(json.error || 'Unable to update the series.');
        return;
      }
      appFeedback.success(
        `Updated ${json.updatedJobCount ?? 0} future visit(s). Past completed visits were not changed.`
      );
      loadJob();
      return;
    }

    const res = await fetch(`/api/recurring-jobs/${job.recurring_series_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        fromDate: job.occurrence_date || job.start_date || undefined,
        cancelFutureJobs:
          action === 'pause'
            ? window.confirm('Also cancel already-generated future visits? Choose Cancel to keep them scheduled.')
            : undefined
      })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setSeriesBusy('');
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to update the series.');
      return;
    }
    appFeedback.success(
      action === 'pause' ? 'Series paused.' : action === 'resume' ? 'Series resumed.' : 'Series ended.'
    );
    loadJob();
  }

  async function bookAgain() {
    if (!job || duplicating) return;
    setDuplicating(true);
    const res = await fetch(`/api/jobs/${job.id}/duplicate`, { method: 'POST' });
    const json = (await res.json().catch(() => ({}))) as { job?: { id: string }; redirectTo?: string; error?: string };
    setDuplicating(false);
    if (!res.ok || !json.job?.id) {
      appFeedback.error(json.error || 'Unable to create a similar job.');
      return;
    }
    appFeedback.success('Draft job created. Confirm the date and time.');
    router.push(json.redirectTo || `/jobs/${json.job.id}?confirmSchedule=1`);
  }

  async function createReport() {
    if (!job || creatingReport) return;
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?next=/jobs/${jobId}`);
      return;
    }
    setCreatingReport(true);
    const usage = await fetchUsageCounts(user.id, orgId || job.organization_id || null);
    if (reportLimitReached(plan, usage)) {
      setCreatingReport(false);
      appFeedback.error(limitMessage('reports', plan));
      return;
    }
    const { error } = await supabase.from('job_reports').insert({ user_id: user.id, organization_id: orgId || job.organization_id, job_id: job.id, title: copy.reportTitle(job.title) });
    setCreatingReport(false);
    if (error) {
      appFeedback.error(error.message.includes('PLAN_LIMIT_REPORTS') ? limitMessage('reports', plan) : formatSupabaseError(error));
      return;
    }
    if (orgId) {
      await createNotification(orgId, user.id, 'report', copy.reportGeneratedTitle, job.title, job.id);
    }
    appFeedback.success(copy.reportCreated);
    router.push(`/jobs/${job.id}/report`);
  }

  useEffect(() => {
    loadJob();
  }, [jobId]);

  if (loading) return <AppShell plan={plan} role={userRole}><div className="card">{copy.loadingJob}</div></AppShell>;
  if (!job) return <AppShell plan={plan} role={userRole}><div className="card">{loadError || copy.jobAccessDenied}</div></AppShell>;

  const canWorkJob = canManage || canEditStatus;
  const priorityLabels = { low: copy.priorityLow, normal: copy.priorityNormal, high: copy.priorityHigh, urgent: copy.priorityUrgent };
  const isCancelledJob = job.status === 'cancelled';
  const refreshFinancials = () => setFinanceRefresh((key) => key + 1);
  const assignedContractorName =
    assignments
      .map((row) => workers.find((worker) => worker.id === row.worker_id)?.name)
      .filter((name): name is string => Boolean(name))
      .join(', ') || null;

  return (
    <AppShell plan={plan} role={userRole}>
      <div className="job-detail-shell">
        <div className="page-head">
          <div>
            <h2>{job.title}</h2>
            <p>{job.address || copy.noAddressAdded}</p>
          </div>
          <div className="button-row" style={{ flexWrap: 'wrap' }}>
            {canManage ? (
              <button type="button" className="btn btn-primary" disabled={duplicating} onClick={() => void bookAgain()}>
                {duplicating ? 'Creating…' : 'Book again'}
              </button>
            ) : null}
            <StatusPill status={job.status} />
          </div>
        </div>

        {confirmSchedule ? (
          <div className="card" style={{ marginBottom: 18, borderColor: 'var(--accent, #0f766e)' }}>
            <h3>Confirm date and time</h3>
            <p className="muted">This draft was created from a past job. Choose the visit date and time before the work is scheduled.</p>
          </div>
        ) : null}

        {completionPrompt && canAccessFinancials(userRole, plan) ? (
          <div className="card" style={{ marginBottom: 18 }} role="status">
            <h3>{billingCopy.jobCompleted}</h3>
            <p className="muted">{billingCopy.jobCompletedHint}</p>
            <div className="button-row" style={{ flexWrap: 'wrap', marginTop: 10 }}>
              <Link
                className="btn btn-primary"
                href={`/invoices?jobId=${job.id}${job.customer_id ? `&customerId=${job.customer_id}` : ''}`}
              >
                {billingCopy.createInvoice}
              </Link>
              <Link
                className="btn"
                href={`/invoices?jobId=${job.id}${job.customer_id ? `&customerId=${job.customer_id}` : ''}`}
              >
                {billingCopy.createDraft}
              </Link>
              <button type="button" className="btn" onClick={() => setCompletionPrompt(false)}>
                {billingCopy.later}
              </button>
            </div>
          </div>
        ) : null}

        <section className="card" style={{ marginBottom: 18 }}>
          <h3>{canManage ? 'Overview' : copy.jobDetailsReadOnly}</h3>
          <p className="muted">
            {canManage
              ? 'This job was created in one step. Update details here without re-entering schedule or contractor setup.'
              : copy.fieldAccessCopy}
          </p>
          {canManage ? (
            <div className="form">
              <label>{copy.title}</label>
              <input className="input" value={job.title} onChange={(e) => setJob({ ...job, title: e.target.value })} />
              <label>{copy.customer}</label>
              <input className="input" value={job.customer_name || ''} onChange={(e) => setJob({ ...job, customer_name: e.target.value })} />
              <label>Email</label>
              <input
                className="input"
                type="email"
                value={job.customer_email || ''}
                onChange={(e) => setJob({ ...job, customer_email: e.target.value })}
              />
              <label>{copy.phone}</label>
              <input className="input" value={job.phone || ''} onChange={(e) => setJob({ ...job, phone: e.target.value })} />
              <AddressAutocomplete
                label={copy.address}
                value={job.address || ''}
                onChange={(formatted) => setJob({ ...job, address: formatted })}
              />
              <label>{copy.jobNotes}</label>
              <textarea className="input" rows={2} value={job.notes || ''} onChange={(e) => setJob({ ...job, notes: e.target.value })} />
              <label>{copy.priority}</label>
              <select className="input" value={job.priority || 'normal'} onChange={(e) => setJob({ ...job, priority: e.target.value })}>
                <option value="low">{copy.priorityLow}</option>
                <option value="normal">{copy.priorityNormal}</option>
                <option value="high">{copy.priorityHigh}</option>
                <option value="urgent">{copy.priorityUrgent}</option>
              </select>
              <label>{copy.customerNotes}</label>
              <textarea className="input" rows={3} value={job.customer_notes || ''} onChange={(e) => setJob({ ...job, customer_notes: e.target.value })} />
              <label>
                <input
                  type="checkbox"
                  checked={!!job.completion_verified}
                  onChange={(e) => setJob({ ...job, completion_verified: e.target.checked })}
                />{' '}
                {copy.completionVerified}
              </label>
              <button type="button" className="btn btn-primary" disabled={savingDetails} onClick={() => void saveJobFields()}>
                {savingDetails ? FEEDBACK.loading : copy.saveDetails}
              </button>
            </div>
          ) : (
            <>
              <p>
                <strong>{copy.customer}:</strong> {displayValue(job.customer_name, copy.notSet)}
              </p>
              <p>
                <strong>Email:</strong> {displayValue(job.customer_email, copy.notSet)}
              </p>
              <p>
                <strong>{copy.phone}:</strong> {displayValue(job.phone, copy.notSet)}
              </p>
              <p>
                <strong>{copy.address}:</strong> {displayValue(job.address, copy.notSet)}
              </p>
              <p>
                <strong>{copy.notes}:</strong> {displayValue(job.notes, copy.noNotes)}
              </p>
              <p>
                <strong>{copy.priority}:</strong> {formatPriority(job.priority, priorityLabels)}
              </p>
            </>
          )}
          <p>
            <strong>{copy.created}:</strong> {formatDateTime(job.created_at, copy.notSet)}
          </p>
          {canEditStatus ? (
            <div className="job-detail-actions">
              <button
                className="btn"
                type="button"
                disabled={updatingStatus || isCancelledJob || isActiveStatus(job.status)}
                onClick={() => updateStatus('active')}
              >
                {updatingStatus ? FEEDBACK.loading : copy.startJob}
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={updatingStatus || isCancelledJob || job.status === 'completed'}
                onClick={() => updateStatus('completed')}
              >
                {updatingStatus ? FEEDBACK.loading : copy.markCompleted}
              </button>
              {isCancelledJob ? (
                <button className="btn" type="button" disabled={updatingStatus} onClick={() => updateStatus('scheduled')}>
                  {updatingStatus ? FEEDBACK.loading : t('pages.jobs.restoreJob')}
                </button>
              ) : (
                <button className="btn job-detail-danger" type="button" disabled={updatingStatus} onClick={() => updateStatus('cancelled')}>
                  {updatingStatus ? FEEDBACK.loading : t('pages.jobs.cancelJob')}
                </button>
              )}
            </div>
          ) : null}
          {canManage ? (
            <div className="card" style={{ marginTop: 16, padding: 12 }}>
              <ClientAccessPanel
                jobId={job.id}
                plan={plan}
                canManage={canManage}
                customerName={job.customer_name}
                customerEmail={job.customer_email}
                onCustomerEmailChange={(email) => setJob({ ...job, customer_email: email })}
                onSaveCustomerEmail={(email) => saveJobFields(FEEDBACK.saved, { customer_email: email })}
              />
            </div>
          ) : null}
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <JobVisitsSchedule
            jobId={job.id}
            organizationId={orgId || job.organization_id}
            canManage={canManage}
            scheduledStart={job.scheduled_start}
            scheduledEnd={job.scheduled_end}
            startDate={job.start_date}
            dueDate={job.due_date}
            timezone={job.timezone}
            onSaved={loadJob}
          />
          <JobAddToCalendar
            job={{
              id: job.id,
              title: job.title,
              customer_name: job.customer_name,
              address: job.address,
              notes: job.notes,
              customer_notes: job.customer_notes,
              scheduled_start: job.scheduled_start,
              scheduled_end: job.scheduled_end,
              start_date: job.start_date,
              due_date: job.due_date,
              assignedNames: assignments
                .map((row) => workers.find((worker) => worker.id === row.worker_id)?.name)
                .filter((name): name is string => Boolean(name))
            }}
          />
        </section>

        {orgId && limitsForPlan(plan).crewAssignment ? (
          <section className="card" style={{ marginBottom: 18 }}>
            <JobAssignments
              jobId={job.id}
              organizationId={orgId}
              userId={job.user_id}
              workers={workers}
              assignments={assignments}
              canManage={canManage}
              recurringSeriesId={job.recurring_series_id}
              occurrenceDate={job.occurrence_date || job.start_date}
              onChange={loadJob}
            />
          </section>
        ) : null}

        <section className="card job-photos-card" style={{ marginBottom: 18 }}>
          <h3>{copy.photosTitle}</h3>
          <p className="muted">{copy.photosCopy}</p>
          <JobPhotosSection
            jobId={job.id}
            organizationId={orgId || job.organization_id}
            plan={plan}
            canUpload={canUploadPhotos}
            showComparison={canAccessFeature(normalizePlan(plan), 'beforeAfterPhotos')}
            refreshKey={photoRefresh}
            onChange={() => {
              setPhotoRefresh((k) => k + 1);
              loadJob();
            }}
          />
        </section>

        {orgId ? (
          <section className="card" style={{ marginBottom: 18 }}>
            <JobChecklist
              jobId={job.id}
              organizationId={orgId}
              userId={job.user_id}
              items={checklist}
              canEdit={canWorkJob}
              canAddItems={canManage}
              onChange={loadJob}
            />
          </section>
        ) : null}

        {canAccessFinancials(userRole, plan) ? (
          <section style={{ marginBottom: 18 }}>
            <h3 style={{ marginBottom: 12 }}>Money</h3>
            <JobProfitabilityCard jobId={job.id} customerId={job.customer_id} canManage={canManage} refreshKey={financeRefresh} />
            <div style={{ marginTop: 18 }}>
              <JobLaborSection
                jobId={job.id}
                workers={workers}
                canManage={canManage}
                assignedContractorName={assignedContractorName}
                onChange={refreshFinancials}
              />
            </div>
          </section>
        ) : null}

        {canManage ? (
          <section className="card" style={{ marginBottom: 18 }}>
            <h3>{copy.proofReport}</h3>
            <p>{copy.proofReportCopy}</p>
            <CustomerReportSharePanel jobId={job.id} canManage={canManage} />
            <div className="button-row" style={{ marginTop: 12 }}>
              <button className="btn btn-primary" type="button" onClick={createReport} disabled={creatingReport}>
                {creatingReport ? copy.creating : copy.createReport}
              </button>
              <Link className="btn" href={`/jobs/${job.id}/report`}>
                {copy.viewLatest}
              </Link>
            </div>
          </section>
        ) : null}

        <details className="card" style={{ marginBottom: 18 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>More / Advanced</summary>
          <div style={{ marginTop: 16 }}>
            {job.recurring_series_id && canManage ? (
              <div style={{ marginBottom: 18 }}>
                <h3>Recurring series</h3>
                <p className="muted">
                  This visit is part of a recurring series{job.occurrence_date ? ` (${job.occurrence_date})` : ''}. Use these
                  actions only when changing future visits or the series.
                </p>
                <div className="button-row" style={{ flexWrap: 'wrap' }}>
                  <button type="button" className="btn" disabled={Boolean(seriesBusy)} onClick={() => void runSeriesAction('skip')}>
                    {seriesBusy === 'skip' ? 'Working…' : 'Skip this visit'}
                  </button>
                  <button type="button" className="btn" disabled={Boolean(seriesBusy)} onClick={() => void runSeriesAction('cancel_visit')}>
                    {seriesBusy === 'cancel_visit' ? 'Working…' : 'Cancel this visit'}
                  </button>
                  <button type="button" className="btn" disabled={Boolean(seriesBusy)} onClick={() => void runSeriesAction('edit_future')}>
                    {seriesBusy === 'edit_future' ? 'Working…' : 'Edit this and future'}
                  </button>
                  <button type="button" className="btn" disabled={Boolean(seriesBusy)} onClick={() => void runSeriesAction('edit_series')}>
                    {seriesBusy === 'edit_series' ? 'Working…' : 'Edit entire series'}
                  </button>
                  <button type="button" className="btn" disabled={Boolean(seriesBusy)} onClick={() => void runSeriesAction('pause')}>
                    {seriesBusy === 'pause' ? 'Working…' : 'Pause series'}
                  </button>
                  <button type="button" className="btn" disabled={Boolean(seriesBusy)} onClick={() => void runSeriesAction('resume')}>
                    {seriesBusy === 'resume' ? 'Working…' : 'Resume series'}
                  </button>
                  <button type="button" className="btn btn-danger" disabled={Boolean(seriesBusy)} onClick={() => void runSeriesAction('end')}>
                    {seriesBusy === 'end' ? 'Working…' : 'End series'}
                  </button>
                </div>
              </div>
            ) : null}

            <JobWorkflow
              jobId={job.id}
              canManage={canManage}
              canComplete={canWorkJob}
              hasWorkflowFeature={limitsForPlan(plan).workflowCustomization}
            />

            {canManage && orgId ? (
              <div style={{ marginTop: 18 }}>
                <RecordSharingPanel organizationId={orgId} recordType="job" recordId={job.id} canManage={canManage} />
              </div>
            ) : null}

            {canViewInternalNotes(userRole) ? (
              <div className="form" style={{ marginTop: 18 }}>
                <h3>Internal metadata</h3>
                <label>{copy.internalNotes}</label>
                <textarea
                  className="input"
                  rows={3}
                  value={job.internal_notes || ''}
                  onChange={(e) => setJob({ ...job, internal_notes: e.target.value })}
                  disabled={!canManage}
                />
                {canManage ? (
                  <button type="button" className="btn" disabled={savingDetails} onClick={() => void saveJobFields()}>
                    {savingDetails ? FEEDBACK.loading : 'Save internal notes'}
                  </button>
                ) : null}
                <p className="muted" style={{ marginTop: 8 }}>
                  Job ID: {job.id}
                </p>
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </AppShell>
  );
}
