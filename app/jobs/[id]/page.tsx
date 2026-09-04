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
  'id', 'user_id', 'title', 'customer_name', 'phone', 'address', 'notes', 'status', 'start_date', 'due_date',
  'scheduled_start', 'scheduled_end', 'assigned_to', 'assigned_email', 'organization_id', 'customer_id',
  'customer_email', 'recurring_series_id', 'occurrence_date', 'is_skipped', 'revenue_amount',
  'expected_contractor_cost', 'expected_additional_expense', 'timezone', 'priority', 'customer_notes',
  'completion_verified', 'created_at'
];

function jobDetailColumns(canReadInternalNotes: boolean): string {
  return [...SAFE_JOB_DETAIL_COLUMNS, ...(canReadInternalNotes ? ['internal_notes'] : [])].join(', ');
}

function displayValue(value: string | null | undefined, fallback: string) {
  return value && value.trim() ? value : fallback;
}

function formatDateTime(value: string | null, fallback: string, locale: string) {
  if (!value) return fallback;
  return new Date(value).toLocaleString(locale);
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
  const [deletingJob, setDeletingJob] = useState(false);
  const [canUploadPhotos, setCanUploadPhotos] = useState(false);
  const [loading, setLoading] = useState(true);
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
    const { data: { user } } = await supabase.auth.getUser();
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

    const assignedWorkerId = (data as { assigned_to?: string | null }).assigned_to || null;
    if (assignedWorkerId && !typedAssignments.some((row) => row.worker_id === assignedWorkerId) && org?.organizationId && isManagerRole(role)) {
      const { data: repaired } = await supabase
        .from('job_assignments')
        .upsert({ job_id: jobId, worker_id: assignedWorkerId, user_id: user.id, organization_id: org.organizationId }, { onConflict: 'job_id,worker_id', ignoreDuplicates: false })
        .select('id, worker_id, responsibility')
        .maybeSingle();
      typedAssignments = repaired
        ? [...typedAssignments, repaired as Assignment]
        : [...typedAssignments, { id: `legacy-${assignedWorkerId}`, worker_id: assignedWorkerId, responsibility: null }];
    }
    setAssignments(typedAssignments);

    const lookupEmail = String(user.email || profile?.email || '').trim().toLowerCase();
    const displayName = String(profile?.full_name || profile?.display_name || '').trim();
    const workerSelect = 'id, auth_user_id, email, active, organization_id, name';
    const [authWorkersRes, emailWorkersRes, orgWorkersRes] = await Promise.all([
      supabase.from('workers').select(workerSelect).eq('auth_user_id', user.id),
      lookupEmail ? supabase.from('workers').select(workerSelect).ilike('email', lookupEmail) : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
      org?.organizationId ? supabase.from('workers').select(workerSelect).eq('organization_id', org.organizationId) : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null })
    ]);
    const workerMap = new Map<string, Record<string, unknown>>();
    for (const row of [...(authWorkersRes.data || []), ...(emailWorkersRes.data || []), ...(orgWorkersRes.data || [])]) {
      workerMap.set(String(row.id), row);
    }
    const identity = contractorIdentityFromWorkers(user.id, Array.from(workerMap.values()), lookupEmail, displayName);
    const identityAliases = workerIdentityAliases(identity);
    const assignedThroughJobAssignments = typedAssignments.some((assignment) => identityAliases.has(String(assignment.worker_id || '')));
    const hasDirectWorkspaceAccess = canAccessWorkspaceRecord(data, user.id, org?.organizationId, role, data.assigned_to, identity.workerIds || []);
    const hasAdditionalAssignmentAccess = Boolean(org?.organizationId) && data.organization_id === org?.organizationId && assignedThroughJobAssignments;

    if (!hasDirectWorkspaceAccess && !hasAdditionalAssignmentAccess) {
      const msg = t('pages.jobs.notFound');
      setLoadError(msg);
      appFeedback.error(msg);
      return;
    }
    const loaded = { ...data, internal_notes: canReadInternalNotes ? data.internal_notes ?? null : null } as Job;
    if (loaded.customer_id) {
      const { data: customerRow } = await supabase
        .from('customers')
        .select('email, phone')
        .eq('id', loaded.customer_id)
        .maybeSingle();
      if (customerRow) {
        loaded.customer_email = customerRow.email || loaded.customer_email || null;
        loaded.phone = customerRow.phone || loaded.phone || null;
      }
    }
    setJob(loaded);
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
    const restoring = job?.status === 'cancelled' && status === 'scheduled';
    const confirmed = status === 'cancelled'
      ? window.confirm(copy.cancelJobConfirm)
      : restoring
        ? window.confirm(copy.restoreJobConfirm)
        : true;
    if (!confirmed) return;
    setUpdatingStatus(true);
    const ok = await patchJob({ status }, restoring ? copy.jobRestored : copy.statusUpdated(status));
    setUpdatingStatus(false);
    if (!ok) return;
    if (orgId && status === 'completed') {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await createNotification(orgId, user.id, 'completion', copy.jobCompletedTitle, job?.title || copy.jobMarkedCompleted, jobId);
      if (canAccessFinancials(userRole, plan) && isManagerRole(userRole)) setCompletionPrompt(true);
    }
    void loadJob();
  }

  async function saveJobFields(successMessage: string = FEEDBACK.saved, overrides?: Partial<Job>) {
    if (!job || !canManage || savingDetails) return false;
    const next = { ...job, ...overrides };
    if (!next.title?.trim()) {
      appFeedback.error(copy.jobTitleRequired);
      return false;
    }
    setSavingDetails(true);
    const ok = await patchJob({
      title: next.title.trim(), customer_name: next.customer_name, customer_email: next.customer_email || null,
      phone: next.phone, address: next.address, notes: next.notes, priority: next.priority,
      internal_notes: next.internal_notes, customer_notes: next.customer_notes, completion_verified: next.completion_verified
    }, successMessage);
    setSavingDetails(false);
    if (!ok) return false;
    setJob(next);
    void loadJob();
    return true;
  }

  async function permanentlyDeleteJob() {
    if (!job || !canManage || deletingJob) return;
    const confirmed = window.confirm(
      job.recurring_series_id ? copy.deleteJobConfirmRecurring : copy.deleteJobConfirmOneTime
    );
    if (!confirmed) return;
    setDeletingJob(true);
    const res = await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' });
    const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string; deletedJobCount?: number };
    setDeletingJob(false);
    if (!res.ok) {
      appFeedback.error(json.error || copy.unableToDeleteJob);
      return;
    }
    appFeedback.success(json.message || FEEDBACK.deleted);
    router.push('/jobs');
    router.refresh();
  }

  async function runSeriesAction(action: 'skip' | 'cancel_visit' | 'pause' | 'resume' | 'end' | 'edit_future' | 'edit_series') {
    if (!job || !canManage || seriesBusy) return;
    setSeriesBusy(action);
    if (action === 'skip' || action === 'cancel_visit') {
      const res = await fetch(`/api/jobs/${job.id}/series-actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      setSeriesBusy('');
      if (!res.ok) {
        appFeedback.error(json.error || copy.unableToUpdateVisit);
        return;
      }
      appFeedback.success(json.message || copy.visitUpdated);
      void loadJob();
      return;
    }
    if (!job.recurring_series_id) {
      setSeriesBusy('');
      return;
    }

    if (action === 'edit_future' || action === 'edit_series') {
      const scope = action === 'edit_future' ? copy.futureScope : copy.seriesScope;
      if (!window.confirm(copy.applySeriesChanges(scope))) {
        setSeriesBusy('');
        return;
      }
      const res = await fetch(`/api/recurring-jobs/${job.recurring_series_id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action, fromDate: job.occurrence_date || job.start_date || undefined, title: job.title, notes: job.notes,
          default_price: job.revenue_amount ?? null, expected_contractor_cost: job.expected_contractor_cost ?? null,
          expected_additional_expense: job.expected_additional_expense ?? null, timezone: job.timezone || null
        })
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; updatedJobCount?: number };
      setSeriesBusy('');
      if (!res.ok) {
        appFeedback.error(json.error || copy.unableToUpdateSeries);
        return;
      }
      appFeedback.success(copy.futureVisitsUpdated(json.updatedJobCount ?? 0));
      void loadJob();
      return;
    }

    const res = await fetch(`/api/recurring-jobs/${job.recurring_series_id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action, fromDate: job.occurrence_date || job.start_date || undefined,
        cancelFutureJobs: action === 'pause' ? window.confirm(copy.cancelGeneratedVisitsConfirm) : undefined
      })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setSeriesBusy('');
    if (!res.ok) {
      appFeedback.error(json.error || copy.unableToUpdateSeries);
      return;
    }
    appFeedback.success(action === 'pause' ? copy.seriesPaused : action === 'resume' ? copy.seriesResumed : copy.seriesEnded);
    void loadJob();
  }

  async function bookAgain() {
    if (!job || duplicating) return;
    setDuplicating(true);
    const res = await fetch(`/api/jobs/${job.id}/duplicate`, { method: 'POST' });
    const json = (await res.json().catch(() => ({}))) as { job?: { id: string }; redirectTo?: string; error?: string };
    setDuplicating(false);
    if (!res.ok || !json.job?.id) {
      appFeedback.error(json.error || copy.duplicateFailed);
      return;
    }
    appFeedback.success(copy.duplicateCreated);
    router.push(json.redirectTo || `/jobs/${json.job.id}?confirmSchedule=1`);
  }

  useEffect(() => {
    void loadJob();
  }, [jobId]);

  if (loading) return <AppShell plan={plan} role={userRole}><div className="card">{copy.loadingJob}</div></AppShell>;
  if (!job) return <AppShell plan={plan} role={userRole}><div className="card">{loadError || copy.jobAccessDenied}</div></AppShell>;

  const canWorkJob = canManage || canEditStatus;
  const isCancelledJob = job.status === 'cancelled';
  const refreshFinancials = () => setFinanceRefresh((key) => key + 1);
  const assignedContractorName = assignments
    .map((row) => workers.find((worker) => worker.id === row.worker_id)?.name)
    .filter((name): name is string => Boolean(name))
    .join(', ') || null;

  return (
    <AppShell plan={plan} role={userRole}>
      <div className="job-detail-shell">
        <div className="page-head">
          <div><h2>{job.title}</h2><p>{job.address || copy.noAddressAdded}</p></div>
          <div className="button-row" style={{ flexWrap: 'wrap' }}>
            {canManage ? (
              <>
                <button type="button" className="btn btn-primary" disabled={duplicating} onClick={() => void bookAgain()}>
                  {duplicating ? copy.creatingJob : copy.bookAgain}
                </button>
                <button type="button" className="btn btn-danger" disabled={deletingJob} onClick={() => void permanentlyDeleteJob()}>
                  {deletingJob ? copy.deletingJob : copy.deleteJob}
                </button>
              </>
            ) : null}
            <StatusPill status={job.status} />
          </div>
        </div>

        {confirmSchedule ? (
          <div className="card" style={{ marginBottom: 18, borderColor: 'var(--accent, #0f766e)' }}>
            <h3>{copy.confirmDateTime}</h3>
            <p className="muted">{copy.confirmDateTimeCopy}</p>
          </div>
        ) : null}

        {completionPrompt && canAccessFinancials(userRole, plan) ? (
          <div className="card" style={{ marginBottom: 18 }} role="status">
            <h3>{billingCopy.jobCompleted}</h3><p className="muted">{billingCopy.jobCompletedHint}</p>
            <div className="button-row" style={{ flexWrap: 'wrap', marginTop: 10 }}>
              <Link className="btn btn-primary" href={`/invoices?jobId=${job.id}${job.customer_id ? `&customerId=${job.customer_id}` : ''}`}>{billingCopy.createInvoice}</Link>
              <Link className="btn" href={`/invoices?jobId=${job.id}${job.customer_id ? `&customerId=${job.customer_id}` : ''}`}>{billingCopy.createDraft}</Link>
              <button type="button" className="btn" onClick={() => setCompletionPrompt(false)}>{billingCopy.later}</button>
            </div>
          </div>
        ) : null}

        <section className="card" style={{ marginBottom: 18 }}>
          <h3>{canManage ? copy.overview : copy.jobDetailsReadOnly}</h3>
          <p className="muted">{canManage ? copy.overviewCopy : copy.fieldAccessCopy}</p>
          {canManage ? (
            <div className="form">
              <label>{copy.title}</label><input className="input" value={job.title} onChange={(e) => setJob({ ...job, title: e.target.value })} />
              <label>{copy.customer}</label><input className="input" value={job.customer_name || ''} onChange={(e) => setJob({ ...job, customer_name: e.target.value })} />
              <AddressAutocomplete label={copy.address} value={job.address || ''} onChange={(formatted) => setJob({ ...job, address: formatted })} />
              <label>{copy.jobNotes}</label><textarea className="input" rows={2} value={job.notes || ''} onChange={(e) => setJob({ ...job, notes: e.target.value })} />
              <button type="button" className="btn btn-primary" disabled={savingDetails} onClick={() => void saveJobFields()}>{savingDetails ? copy.saving : copy.saveDetails}</button>
            </div>
          ) : (
            <>
              <p><strong>{copy.customer}:</strong> {displayValue(job.customer_name, copy.notSet)}</p>
              <p><strong>{copy.address}:</strong> {displayValue(job.address, copy.notSet)}</p>
              <p><strong>{copy.notes}:</strong> {displayValue(job.notes, copy.noNotes)}</p>
            </>
          )}
          <p><strong>{copy.created}:</strong> {formatDateTime(job.created_at, copy.notSet, locale)}</p>
          {canEditStatus ? (
            <div className="job-detail-actions">
              <button className="btn" type="button" disabled={updatingStatus || isCancelledJob || isActiveStatus(job.status)} onClick={() => void updateStatus('active')}>{updatingStatus ? copy.working : copy.startJob}</button>
              <button className="btn btn-primary" type="button" disabled={updatingStatus || isCancelledJob || job.status === 'completed'} onClick={() => void updateStatus('completed')}>{updatingStatus ? copy.working : copy.markCompleted}</button>
              {isCancelledJob ? (
                <button className="btn" type="button" disabled={updatingStatus} onClick={() => void updateStatus('scheduled')}>{updatingStatus ? copy.working : t('pages.jobs.restoreJob')}</button>
              ) : (
                <button className="btn job-detail-danger" type="button" disabled={updatingStatus} onClick={() => void updateStatus('cancelled')}>{updatingStatus ? copy.working : t('pages.jobs.cancelJob')}</button>
              )}
            </div>
          ) : null}
          {canManage ? (
            <details style={{ marginTop: 16 }}>
              <summary>Customer access</summary>
              <div className="card" style={{ marginTop: 16, padding: 12 }}>
                <ClientAccessPanel jobId={job.id} plan={plan} canManage={canManage} customerName={job.customer_name} customerEmail={job.customer_email}
                  onCustomerEmailChange={(email) => setJob({ ...job, customer_email: email })}
                  onSaveCustomerEmail={(email) => saveJobFields(FEEDBACK.saved, { customer_email: email })} />
              </div>
            </details>
          ) : null}
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <JobVisitsSchedule jobId={job.id} organizationId={orgId || job.organization_id} canManage={canManage}
            scheduledStart={job.scheduled_start} scheduledEnd={job.scheduled_end} startDate={job.start_date}
            dueDate={job.due_date} timezone={job.timezone} onSaved={loadJob} />
          <JobAddToCalendar job={{
            id: job.id, title: job.title, customer_name: job.customer_name, address: job.address, notes: job.notes,
            customer_notes: job.customer_notes, scheduled_start: job.scheduled_start, scheduled_end: job.scheduled_end,
            start_date: job.start_date, due_date: job.due_date,
            assignedNames: assignments.map((row) => workers.find((worker) => worker.id === row.worker_id)?.name).filter((name): name is string => Boolean(name))
          }} />
        </section>

        {orgId && limitsForPlan(plan).crewAssignment ? (
          <section className="card" style={{ marginBottom: 18 }}>
            <JobAssignments jobId={job.id} organizationId={orgId} userId={job.user_id} workers={workers} assignments={assignments}
              canManage={canManage} recurringSeriesId={job.recurring_series_id} occurrenceDate={job.occurrence_date || job.start_date} onChange={loadJob} />
          </section>
        ) : null}

        <section className="card job-photos-card" style={{ marginBottom: 18 }}>
          <h3>{copy.photosTitle}</h3><p className="muted">{copy.photosCopy}</p>
          <JobPhotosSection jobId={job.id} organizationId={orgId || job.organization_id} plan={plan} canUpload={canUploadPhotos}
            showComparison={canAccessFeature(normalizePlan(plan), 'beforeAfterPhotos')} refreshKey={photoRefresh}
            onChange={() => { setPhotoRefresh((key) => key + 1); void loadJob(); }} />
        </section>

        {orgId ? (
          <section className="card" style={{ marginBottom: 18 }}>
            <JobChecklist jobId={job.id} organizationId={orgId} userId={job.user_id} items={checklist}
              canEdit={canWorkJob} canAddItems={canManage} onChange={loadJob} />
          </section>
        ) : null}

        {canAccessFinancials(userRole, plan) ? (
          <section style={{ marginBottom: 18 }}>
            <h3 style={{ marginBottom: 12 }}>{copy.money}</h3>
            <JobProfitabilityCard jobId={job.id} customerId={job.customer_id} canManage={canManage} refreshKey={financeRefresh} />
            <div style={{ marginTop: 18 }}><JobLaborSection jobId={job.id} workers={workers} canManage={canManage}
              assignedContractorName={assignedContractorName} onChange={refreshFinancials} /></div>
          </section>
        ) : null}

        <details className="card" style={{ marginBottom: 18 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{copy.moreAdvanced}</summary>
          <div style={{ marginTop: 16 }}>
            {job.recurring_series_id && canManage ? (
              <div style={{ marginBottom: 18 }}>
                <h3>{copy.recurringSeries}</h3><p className="muted">{copy.recurringSeriesCopy(job.occurrence_date)}</p>
                <div className="button-row" style={{ flexWrap: 'wrap' }}>
                  <button type="button" className="btn" disabled={Boolean(seriesBusy)} onClick={() => void runSeriesAction('skip')}>{seriesBusy === 'skip' ? copy.working : copy.skipVisit}</button>
                  <button type="button" className="btn" disabled={Boolean(seriesBusy)} onClick={() => void runSeriesAction('cancel_visit')}>{seriesBusy === 'cancel_visit' ? copy.working : copy.cancelVisit}</button>
                  <button type="button" className="btn" disabled={Boolean(seriesBusy)} onClick={() => void runSeriesAction('edit_future')}>{seriesBusy === 'edit_future' ? copy.working : copy.editFuture}</button>
                  <button type="button" className="btn" disabled={Boolean(seriesBusy)} onClick={() => void runSeriesAction('edit_series')}>{seriesBusy === 'edit_series' ? copy.working : copy.editSeries}</button>
                  <button type="button" className="btn" disabled={Boolean(seriesBusy)} onClick={() => void runSeriesAction('pause')}>{seriesBusy === 'pause' ? copy.working : copy.pauseSeries}</button>
                  <button type="button" className="btn" disabled={Boolean(seriesBusy)} onClick={() => void runSeriesAction('resume')}>{seriesBusy === 'resume' ? copy.working : copy.resumeSeries}</button>
                  <button type="button" className="btn btn-danger" disabled={Boolean(seriesBusy)} onClick={() => void runSeriesAction('end')}>{seriesBusy === 'end' ? copy.working : copy.endSeries}</button>
                </div>
              </div>
            ) : null}

            <JobWorkflow jobId={job.id} canManage={canManage} canComplete={canWorkJob} hasWorkflowFeature={limitsForPlan(plan).workflowCustomization} />
            {canManage && orgId ? <div style={{ marginTop: 18 }}><RecordSharingPanel organizationId={orgId} recordType="job" recordId={job.id} canManage={canManage} /></div> : null}

            {canViewInternalNotes(userRole) ? (
              <div className="form" style={{ marginTop: 18 }}>
                <h3>{copy.internalMetadata}</h3><label>{copy.internalNotes}</label>
                <textarea className="input" rows={3} value={job.internal_notes || ''} onChange={(e) => setJob({ ...job, internal_notes: e.target.value })} disabled={!canManage} />
                {canManage ? <button type="button" className="btn" disabled={savingDetails} onClick={() => void saveJobFields()}>{savingDetails ? copy.saving : copy.saveInternalNotes}</button> : null}
                <p className="muted" style={{ marginTop: 8 }}>{copy.jobId}: {job.id}</p>
              </div>
            ) : null}
          </div>
        </details>

        {canManage ? (
          <section className="card" style={{ marginBottom: 18 }}>
            <h3>{copy.deleteJob}</h3>
            <p className="muted">
              {job.recurring_series_id ? copy.deleteJobSectionCopyRecurring : copy.deleteJobSectionCopyOneTime}
            </p>
            <div className="button-row" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-danger"
                disabled={deletingJob}
                onClick={() => void permanentlyDeleteJob()}
              >
                {deletingJob ? copy.deletingJob : copy.deleteJob}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
