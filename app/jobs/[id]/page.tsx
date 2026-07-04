'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActivityFeed } from '@/components/activity-feed';
import { JobAssignments } from '@/components/job-assignments';
import { JobChecklist } from '@/components/job-checklist';
import { ClientAccessPanel } from '@/components/client-access-panel';
import { JobWorkflow } from '@/components/job-workflow';
import { JobPhotosSection } from '@/components/job-photos-section';
import { JobLaborSection } from '@/components/job-labor-section';
import { JobProfitabilityCard } from '@/components/job-profitability-card';
import { AppShell } from '@/components/app-shell';
import { canAccessFinancialTracking } from '@/lib/finance-access';
import { fetchOrganizationContext } from '@/lib/organization';
import { logClientActivity, createNotification } from '@/lib/activity';
import { StatusPill } from '@/components/status-pill';
import { canAccessFeature } from '@/lib/plan-access';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchUsageCounts, reportLimitReached, limitMessage } from '@/lib/everittos-usage';
import { hasPermission } from '@/lib/permissions';
import { canViewInternalNotes, isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { canAccessWorkspaceRecord } from '@/lib/workspace-record-access';
import { formatSupabaseError } from '@/lib/action-messages';
import { FEEDBACK } from '@/lib/feedback-labels';
import { combineDateAndTime, formatScheduleDuration, hoursBetween, localTimeFromIso } from '@/lib/schedule-times';
import { validateAssignedEmail } from '@/lib/job-assigned-email';
import { getJobDetailCopy } from '@/lib/i18n/job-detail-copy';
import { supabase } from '@/lib/supabase';

type PageProps = {
  params: Promise<{ id: string }>;
};

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
  priority: string | null;
  internal_notes: string | null;
  customer_notes: string | null;
  completion_verified: boolean | null;
  created_at: string | null;
};

type Worker = { id: string; name: string };

type TimelineEntry = {
  id: string;
  message: string | null;
  event_type: string;
  created_at: string | null;
};

function displayValue(value: string | null | undefined, fallback: string) {
  return value && value.trim() ? value : fallback;
}

function formatPriority(value: string | null, labels: { low: string; normal: string; high: string; urgent: string }) {
  if (value === 'low') return labels.low;
  if (value === 'high') return labels.high;
  if (value === 'urgent') return labels.urgent;
  return labels.normal;
}

function formatDate(value: string | null, fallback: string) {
  if (!value) return fallback;
  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

function formatDateTime(value: string | null, fallback: string) {
  if (!value) return fallback;
  return new Date(value).toLocaleString();
}

export default function JobDetailPage({ params }: PageProps) {
  const router = useRouter();
  const [jobId, setJobId] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [activity, setActivity] = useState<
    { id: string; action: string; message: string | null; entity_type: string; created_at: string | null; actor_name: string | null }[]
  >([]);
  const [assignments, setAssignments] = useState<{ id: string; worker_id: string; responsibility: string | null }[]>([]);
  const [checklist, setChecklist] = useState<{ id: string; label: string; completed: boolean; sort_order: number }[]>([]);
  const [orgId, setOrgId] = useState('');
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [userRole, setUserRole] = useState<UserRole>('owner');
  const [canManage, setCanManage] = useState(false);
  const [canEditStatus, setCanEditStatus] = useState(false);
  const [canUploadPhotos, setCanUploadPhotos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [creatingReport, setCreatingReport] = useState(false);
  const [photoRefresh, setPhotoRefresh] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [removingJob, setRemovingJob] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const appFeedback = useAppFeedback();
  const { t, locale } = useTranslation();
  const copy = getJobDetailCopy(locale);

  useEffect(() => {
    params.then((p) => setJobId(p.id));
  }, [params]);

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

    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const org = await fetchOrganizationContext(user.id);
    const role = normalizeRole(org?.role || profile?.role);
    const userPlan = normalizePlan(profile?.plan);

    setUserRole(role);
    setPlan(userPlan);
    setCanManage(isManagerRole(role));
    setCanEditStatus(hasPermission(role, 'update_status'));
    setCanUploadPhotos(
      isManagerRole(role) || hasPermission(role, 'upload_before_photos') || hasPermission(role, 'upload_after_photos')
    );

    if (org) setOrgId(org.organizationId);

    const { data, error } = await supabase.from('jobs').select('*').eq('id', jobId).single();
    const { data: notes } = await supabase
      .from('job_timeline')
      .select('id, message, event_type, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    const [{ data: assignRows }, { data: checklistRows }, { data: activityRows }] = await Promise.all([
      supabase.from('job_assignments').select('id, worker_id, responsibility').eq('job_id', jobId),
      supabase.from('job_checklist_items').select('id, label, completed, sort_order').eq('job_id', jobId).order('sort_order'),
      org?.organizationId && limitsForPlan(userPlan).activityLog
        ? supabase
            .from('activity_logs')
            .select('id, action, message, entity_type, created_at, actor_name')
            .eq('organization_id', org.organizationId)
            .eq('entity_id', jobId)
            .order('created_at', { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [] })
    ]);

    setAssignments(assignRows || []);
    setChecklist(checklistRows || []);
    setActivity(activityRows || []);

    if (limitsForPlan(userPlan).crewAssignment) {
      let workersQuery = supabase.from('workers').select('id, name').order('name');
      if (org?.organizationId) {
        workersQuery = workersQuery.eq('organization_id', org.organizationId);
      } else {
        workersQuery = workersQuery.eq('user_id', user.id);
      }
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

    if (!canAccessWorkspaceRecord(data, user.id, org?.organizationId, role, data.assigned_to)) {
      const msg = t('pages.jobs.notFound');
      setLoadError(msg);
      appFeedback.error(msg);
      return;
    }

    setJob(data);
    setStartTime(localTimeFromIso(data.scheduled_start, '09:00'));
    setEndTime(localTimeFromIso(data.scheduled_end, '17:00'));
    setTimeline(notes || []);
  }

  async function patchJob(fields: Record<string, unknown>, successMessage: string) {
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    });
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
    setUpdatingStatus(true);
    const ok = await patchJob({ status }, copy.statusUpdated(status));
    setUpdatingStatus(false);
    if (!ok) return;
    if (orgId) {
      await logClientActivity(orgId, 'job', jobId, 'status_changed', `Status set to ${status}`);
      if (status === 'completed') {
        const {
          data: { user: u }
        } = await supabase.auth.getUser();
        if (u) await createNotification(orgId, u.id, 'completion', copy.jobCompletedTitle, job?.title || copy.jobMarkedCompleted, jobId);
      }
    }
    loadJob();
  }

  async function saveJobFields() {
    if (!job || !canManage || savingDetails) return;
    if (!job.title?.trim()) {
      appFeedback.error(copy.jobTitleRequired);
      return;
    }
    const emailCheck = validateAssignedEmail(job.assigned_email);
    if (!emailCheck.ok) {
      appFeedback.error(emailCheck.error);
      return;
    }
    setSavingDetails(true);
    const ok = await patchJob(
      {
        title: job.title.trim(),
        customer_name: job.customer_name,
        phone: job.phone,
        address: job.address,
        notes: job.notes,
        priority: job.priority,
        internal_notes: job.internal_notes,
        customer_notes: job.customer_notes,
        completion_verified: job.completion_verified,
        assigned_email: emailCheck.email
      },
      FEEDBACK.saved
    );
    setSavingDetails(false);
    if (!ok) return;
    if (orgId) await logClientActivity(orgId, 'job', jobId, 'job_edited', 'Job details updated');
    loadJob();
  }

  async function saveSchedule() {
    if (!job || !canManage || savingSchedule) return;

    setSavingSchedule(true);

    const startDate = job.start_date || job.due_date;
    const dueDate = job.due_date || job.start_date;
    const scheduledStart = startDate ? combineDateAndTime(startDate, startTime) : null;
    const scheduledEnd = dueDate ? combineDateAndTime(dueDate, endTime) : null;

    const res = await fetch('/api/schedule/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: job.id,
        start_date: job.start_date || null,
        due_date: job.due_date || null,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd
      })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    setSavingSchedule(false);

    if (!res.ok) {
      appFeedback.error(json.error || copy.unableToSaveSchedule);
      return;
    }

    appFeedback.success(json.message || copy.scheduleSaved);
    if (orgId) {
      await logClientActivity(orgId, 'job', jobId, 'schedule_changed', 'Schedule updated from job detail');
    }
    loadJob();
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

    const { error } = await supabase.from('job_reports').insert({
      user_id: user.id,
      organization_id: orgId || job.organization_id,
      job_id: job.id,
      title: copy.reportTitle(job.title)
    });

    setCreatingReport(false);

    if (error) {
      if (error.message.includes('PLAN_LIMIT_REPORTS')) {
        appFeedback.error(limitMessage('reports', plan));
      } else {
        appFeedback.error(formatSupabaseError(error));
      }
      return;
    }

    if (orgId) {
      await logClientActivity(orgId, 'job', job.id, 'report_generated', 'Proof report created');
      await createNotification(orgId, user.id, 'report', copy.reportGeneratedTitle, job.title, job.id);
    }
    appFeedback.success(copy.reportCreated);
    router.push(`/jobs/${job.id}/report`);
  }

  useEffect(() => {
    loadJob();
  }, [jobId]);

  if (loading) {
    return (
      <AppShell plan={plan} role={userRole}>
        <div className="card">{copy.loadingJob}</div>
      </AppShell>
    );
  }

  if (!job) {
    return (
      <AppShell plan={plan} role={userRole}>
        <div className="card">{loadError || copy.jobAccessDenied}</div>
      </AppShell>
    );
  }

  const crewEnabled = limitsForPlan(plan).crewAssignment;
  const canWorkJob = canManage || canEditStatus;
  const assignedEmailDisplay = job.assigned_email?.trim() || null;
  const accessTitle = canManage ? copy.managementAccess : copy.fieldAccess;
  const accessCopy = canManage ? copy.managementAccessCopy : copy.fieldAccessCopy;
  const priorityLabels = {
    low: copy.priorityLow,
    normal: copy.priorityNormal,
    high: copy.priorityHigh,
    urgent: copy.priorityUrgent
  };
  const scheduleHours = hoursBetween(
    job.scheduled_start || (job.start_date ? combineDateAndTime(job.start_date, startTime) : null),
    job.scheduled_end || (job.due_date ? combineDateAndTime(job.due_date, endTime) : null)
  );

  return (
    <AppShell plan={plan} role={userRole}>
      <div className="page-head">
        <div>
          <h2>{job.title}</h2>
          <p>{job.address || copy.noAddressAdded}</p>
        </div>
        <StatusPill status={job.status} />
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3>{accessTitle}</h3>
        <p className="muted">{accessCopy}</p>
        {assignedEmailDisplay ? (
          <p>
            <strong>{copy.assignedEmail}:</strong> {assignedEmailDisplay}
          </p>
        ) : null}
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>{canManage ? copy.jobDetails : copy.jobDetailsReadOnly}</h3>
          {canManage ? (
            <div className="form">
              <label>{copy.title}</label>
              <input className="input" value={job.title} onChange={(e) => setJob({ ...job, title: e.target.value })} />
              <label>{copy.customer}</label>
              <input
                className="input"
                value={job.customer_name || ''}
                onChange={(e) => setJob({ ...job, customer_name: e.target.value })}
              />
              <label>{copy.phone}</label>
              <input className="input" value={job.phone || ''} onChange={(e) => setJob({ ...job, phone: e.target.value })} />
              <label>{copy.address}</label>
              <input className="input" value={job.address || ''} onChange={(e) => setJob({ ...job, address: e.target.value })} />
              <label htmlFor="job-detail-assigned-email">{copy.assignedEmail}</label>
              <input
                id="job-detail-assigned-email"
                className="input"
                type="email"
                placeholder="name@company.com"
                value={job.assigned_email || ''}
                onChange={(e) => setJob({ ...job, assigned_email: e.target.value })}
                autoComplete="email"
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
              {canViewInternalNotes(userRole) && (
                <>
                  <label>{copy.internalNotes}</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={job.internal_notes || ''}
                    onChange={(e) => setJob({ ...job, internal_notes: e.target.value })}
                  />
                </>
              )}
              <label>{copy.customerNotes}</label>
              <textarea
                className="input"
                rows={3}
                value={job.customer_notes || ''}
                onChange={(e) => setJob({ ...job, customer_notes: e.target.value })}
              />
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
              <button
                type="button"
                className="btn btn-danger"
                style={{ marginLeft: 8 }}
                disabled={removingJob}
                onClick={async () => {
                  if (!window.confirm(copy.removeJobConfirm)) return;
                  setRemovingJob(true);
                  const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
                  const json = (await res.json().catch(() => ({}))) as { error?: string; cancelled?: boolean };
                  setRemovingJob(false);
                  if (!res.ok) {
                    appFeedback.error(json.error || copy.unableToRemoveJob);
                    return;
                  }
                  appFeedback.success(json.cancelled ? copy.jobMarkedCancelled : FEEDBACK.deleted);
                  router.push('/jobs');
                }}
              >
                {removingJob ? FEEDBACK.loading : copy.removeJob}
              </button>
            </div>
          ) : (
            <>
              <p><strong>{copy.customer}:</strong> {displayValue(job.customer_name, copy.notSet)}</p>
              <p><strong>{copy.phone}:</strong> {displayValue(job.phone, copy.notSet)}</p>
              <p><strong>{copy.address}:</strong> {displayValue(job.address, copy.notSet)}</p>
              <p><strong>{copy.assignedEmail}:</strong> {displayValue(job.assigned_email, copy.notSet)}</p>
              <p><strong>{copy.notes}:</strong> {displayValue(job.notes, copy.noNotes)}</p>
              <p><strong>{copy.priority}:</strong> {formatPriority(job.priority, priorityLabels)}</p>
            </>
          )}
          <p><strong>{copy.created}:</strong> {formatDateTime(job.created_at, copy.notSet)}</p>

          {canEditStatus && (
            <div className="form" style={{ marginTop: 16 }}>
              <button className="btn" type="button" disabled={updatingStatus || job.status === 'in_progress'} onClick={() => updateStatus('in_progress')}>
                {updatingStatus ? FEEDBACK.loading : copy.startJob}
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={updatingStatus || job.status === 'completed'}
                onClick={() => updateStatus('completed')}
              >
                {updatingStatus ? FEEDBACK.loading : copy.markCompleted}
              </button>
            </div>
          )}
        </div>

        <div className="card form">
          <h3>{canManage ? copy.schedule : copy.scheduleReadOnly}</h3>
          {canManage ? (
            <>
              <label>{copy.startDate}</label>
              <input className="input" type="date" value={job.start_date || ''} onChange={(e) => setJob({ ...job, start_date: e.target.value })} />
              <label>{copy.startTime}</label>
              <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              <label>{copy.dueDate}</label>
              <input className="input" type="date" value={job.due_date || ''} onChange={(e) => setJob({ ...job, due_date: e.target.value })} />
              <label>{copy.endTime}</label>
              <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </>
          ) : (
            <>
              <p><strong>{copy.start}:</strong> {job.scheduled_start ? formatDateTime(job.scheduled_start, copy.notSet) : formatDate(job.start_date, copy.notScheduled)}</p>
              <p><strong>{copy.due}:</strong> {job.scheduled_end ? formatDateTime(job.scheduled_end, copy.notSet) : formatDate(job.due_date, copy.notScheduled)}</p>
            </>
          )}
          {scheduleHours != null ? (
            <p className="muted">
              {copy.scheduledDuration(formatScheduleDuration(
                combineDateAndTime(job.start_date || '', startTime),
                combineDateAndTime(job.due_date || job.start_date || '', endTime)
              ))}
            </p>
          ) : null}
          {canManage && (
            <button className="btn btn-primary" type="button" onClick={saveSchedule} disabled={savingSchedule}>
              {savingSchedule ? copy.saving : copy.saveSchedule}
            </button>
          )}
        </div>
      </div>

      {crewEnabled && orgId && (
        <div className="card" style={{ marginTop: 18 }}>
          <JobAssignments
            jobId={job.id}
            organizationId={orgId}
            userId={job.user_id}
            workers={workers}
            assignments={assignments}
            canManage={canManage}
            onChange={loadJob}
          />
        </div>
      )}

      {orgId && (
        <div className="card" style={{ marginTop: 18 }}>
          <JobChecklist
            jobId={job.id}
            organizationId={orgId}
            userId={job.user_id}
            items={checklist}
            canEdit={canWorkJob}
            canAddItems={canManage}
            onChange={loadJob}
          />
        </div>
      )}

      <JobWorkflow
        jobId={job.id}
        canManage={canManage}
        canComplete={canWorkJob}
        hasWorkflowFeature={limitsForPlan(plan).workflowCustomization}
      />

      {canAccessFinancialTracking(plan) ? (
        <>
          <div style={{ marginTop: 18 }}>
            <JobProfitabilityCard jobId={job.id} customerId={job.customer_id} canManage={canManage} />
          </div>
          <div style={{ marginTop: 18 }}>
            <JobLaborSection jobId={job.id} workers={workers} canManage={canManage} />
          </div>
        </>
      ) : null}

      <ClientAccessPanel jobId={job.id} plan={plan} canManage={canManage} />

      <div className="card job-photos-card" style={{ marginTop: 18 }}>
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
      </div>

      {canManage && (
        <div className="card" style={{ marginTop: 18 }}>
          <h3>{copy.proofReport}</h3>
          <p>{copy.proofReportCopy}</p>
          <button className="btn btn-primary" type="button" onClick={createReport} disabled={creatingReport}>
            {creatingReport ? copy.creating : copy.createReport}
          </button>
          <Link className="btn" href={`/jobs/${job.id}/report`} style={{ marginLeft: 8 }}>
            {copy.viewLatest}
          </Link>
        </div>
      )}

      {isManagerRole(userRole) && (
        <div className="card" style={{ marginTop: 18 }}>
          <h3>{copy.activityTimeline}</h3>
          {activity.length > 0 ? (
            <ActivityFeed items={activity} />
          ) : (
            <>
              {timeline.length === 0 && <p>{copy.noTimelineEntries}</p>}
              {timeline.map((entry) => (
                <div key={entry.id} style={{ marginTop: 10 }}>
                  <strong>{entry.event_type}</strong>
                  <p>{entry.message || copy.updateRecorded}</p>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}
