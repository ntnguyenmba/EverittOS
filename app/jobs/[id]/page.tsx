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
import {
  fetchUsageCounts,
  photoLimitReached,
  reportLimitReached,
  limitMessage
} from '@/lib/everittos-usage';
import { hasPermission } from '@/lib/permissions';
import { canViewInternalNotes, isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { ActionFeedbackBanner } from '@/components/action-feedback';
import { errorFeedback, formatSupabaseError, successFeedback, type ActionFeedback } from '@/lib/action-messages';
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
  assigned_to: string | null;
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
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

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
    const role = normalizeRole(profile?.role);
    setUserRole(role);
    const userPlan = normalizePlan(profile?.plan);
    setPlan(userPlan);
    setCanManage(isManagerRole(role));
    setCanEditStatus(hasPermission(role, 'update_status'));
    setCanUploadPhotos(
      hasPermission(role, 'upload_before_photos') || hasPermission(role, 'upload_after_photos')
    );

    const org = await fetchOrganizationContext(user.id);
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

    if (error) {
      setFeedback(errorFeedback(formatSupabaseError(error)));
      return;
    }

    setJob(data);
    setTimeline(notes || []);
  }

  async function updateStatus(status: string) {
    if (!canEditStatus) return;
    const { error } = await supabase.from('jobs').update({ status }).eq('id', jobId);
    if (error) {
      setFeedback(errorFeedback(formatSupabaseError(error)));
      return;
    }
    setFeedback(successFeedback(`Status updated to ${status.replace('_', ' ')}.`));
    if (orgId) {
      await logClientActivity(orgId, 'job', jobId, 'status_changed', `Status set to ${status}`);
      if (status === 'completed') {
        const {
          data: { user: u }
        } = await supabase.auth.getUser();
        if (u) await createNotification(orgId, u.id, 'completion', 'Job completed', job?.title || 'Job marked completed', jobId);
      }
    }
    loadJob();
  }

  async function saveJobFields() {
    if (!job || !canManage) return;
    const { error } = await supabase
      .from('jobs')
      .update({
        priority: job.priority,
        internal_notes: job.internal_notes,
        customer_notes: job.customer_notes,
        completion_verified: job.completion_verified
      })
      .eq('id', jobId);
    if (error) {
      setFeedback(errorFeedback(formatSupabaseError(error)));
      return;
    }
    setFeedback(successFeedback('Job details saved.'));
    if (orgId) await logClientActivity(orgId, 'job', jobId, 'job_edited', 'Job details updated');
    loadJob();
  }

  async function saveSchedule() {
    if (!job || !canManage || savingSchedule) return;

    setSavingSchedule(true);
    setFeedback(null);

    const { error } = await supabase
      .from('jobs')
      .update({
        start_date: job.start_date || null,
        due_date: job.due_date || null,
        assigned_to: job.assigned_to || null
      })
      .eq('id', jobId);

    setSavingSchedule(false);

    if (error) {
      setFeedback(errorFeedback(formatSupabaseError(error)));
      return;
    }

    setFeedback(successFeedback('Schedule saved.'));
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
    setFeedback(null);

    const usage = await fetchUsageCounts(user.id);
    if (reportLimitReached(plan, usage)) {
      setCreatingReport(false);
      setFeedback(errorFeedback(limitMessage('reports', plan)));
      return;
    }

    const { error } = await supabase.from('job_reports').insert({
      user_id: user.id,
      job_id: job.id,
      title: `${job.title} report`
    });

    setCreatingReport(false);

    if (error) {
      if (error.message.includes('PLAN_LIMIT_REPORTS')) {
        setFeedback(errorFeedback(limitMessage('reports', plan)));
      } else {
        setFeedback(errorFeedback(formatSupabaseError(error)));
      }
      return;
    }

    if (orgId) {
      await logClientActivity(orgId, 'job', job.id, 'report_generated', 'Proof report created');
      await createNotification(orgId, user.id, 'report', 'Report generated', job.title, job.id);
    }
    router.push(`/jobs/${job.id}/report`);
  }

  useEffect(() => {
    loadJob();
  }, [jobId]);

  if (loading) {
    return (
      <AppShell plan={plan} role={userRole}>
        <div className="card">Loading job...</div>
      </AppShell>
    );
  }

  if (!job) {
    return (
      <AppShell plan={plan} role={userRole}>
        <div className="card">
          {feedback?.message || 'Job not found or access denied.'}
        </div>
      </AppShell>
    );
  }

  const crewEnabled = limitsForPlan(plan).crewAssignment;

  return (
    <AppShell plan={plan} role={userRole}>
        <div className="page-head">
          <div>
            <h2>{job.title}</h2>
            <p>{job.address || 'No address added'}</p>
          </div>
          <StatusPill status={job.status} />
        </div>

        <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

        <div className="grid-2">
          <div className="card">
            <h3>Job details</h3>
            <p>
              <strong>Customer:</strong> {job.customer_name || 'Not set'}
            </p>
            <p>
              <strong>Phone:</strong> {job.phone || 'Not set'}
            </p>
            <p>
              <strong>Notes:</strong> {job.notes || 'No notes'}
            </p>
            <p>
              <strong>Priority:</strong> {job.priority || 'normal'}
            </p>
            {canManage && (
              <div className="form" style={{ marginTop: 12 }}>
                <label>Priority</label>
                <select
                  className="input"
                  value={job.priority || 'normal'}
                  onChange={(e) => setJob({ ...job, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                {canViewInternalNotes(userRole) && (
                  <>
                    <label>Internal notes</label>
                    <textarea
                      className="input"
                      rows={3}
                      value={job.internal_notes || ''}
                      onChange={(e) => setJob({ ...job, internal_notes: e.target.value })}
                    />
                  </>
                )}
                <label>Customer notes</label>
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
                  Completion verified
                </label>
                <button type="button" className="btn" onClick={saveJobFields}>
                  Save details
                </button>
              </div>
            )}
            <p>
              <strong>Created:</strong> {job.created_at ? new Date(job.created_at).toLocaleString() : 'Just created'}
            </p>

            {canEditStatus && (
              <div className="form" style={{ marginTop: 16 }}>
                <button className="btn" type="button" onClick={() => updateStatus('in_progress')}>
                  Start job
                </button>
                <button className="btn btn-primary" type="button" onClick={() => updateStatus('completed')}>
                  Mark completed
                </button>
              </div>
            )}
          </div>

          <div className="card form">
            <h3>Schedule</h3>
            <label>Start date</label>
            <input
              className="input"
              type="date"
              disabled={!canManage}
              value={job.start_date || ''}
              onChange={(e) => setJob({ ...job, start_date: e.target.value })}
            />
            <label>Due date</label>
            <input
              className="input"
              type="date"
              disabled={!canManage}
              value={job.due_date || ''}
              onChange={(e) => setJob({ ...job, due_date: e.target.value })}
            />
            {crewEnabled ? (
              <>
                <label>Assigned worker</label>
                <select
                  className="input"
                  disabled={!canManage}
                  value={job.assigned_to || ''}
                  onChange={(e) => setJob({ ...job, assigned_to: e.target.value || null })}
                >
                  <option value="">Unassigned</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <p>Crew assignment is available on the Business plan.</p>
            )}
            {canManage && (
              <button className="btn btn-primary" type="button" onClick={saveSchedule} disabled={savingSchedule}>
                {savingSchedule ? 'Saving...' : 'Save schedule'}
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
              canEdit={canManage}
              onChange={loadJob}
            />
          </div>
        )}

        <JobWorkflow
          jobId={job.id}
          canManage={canManage}
          canComplete={canManage || canEditStatus}
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
          <h3>Before &amp; after photos</h3>
          <p className="muted">
            Document the job with before and after photos. Upload from your phone camera or desktop. Files are stored
            securely in your workspace.
          </p>
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

        <div className="card" style={{ marginTop: 18 }}>
          <h3>Proof report</h3>
          <p>Generate a printable report with job details and photos.</p>
          <button className="btn btn-primary" type="button" onClick={createReport} disabled={creatingReport}>
            {creatingReport ? 'Creating...' : 'Create report'}
          </button>
          <Link className="btn" href={`/jobs/${job.id}/report`} style={{ marginLeft: 8 }}>
            View latest
          </Link>
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <h3>Activity timeline</h3>
          {activity.length > 0 ? (
            <ActivityFeed items={activity} />
          ) : (
            <>
              {timeline.length === 0 && <p>No timeline entries yet.</p>}
              {timeline.map((entry) => (
                <div key={entry.id} style={{ marginTop: 10 }}>
                  <strong>{entry.event_type}</strong>
                  <p>{entry.message || 'Update recorded'}</p>
                </div>
              ))}
            </>
          )}
        </div>
    </AppShell>
  );
}
