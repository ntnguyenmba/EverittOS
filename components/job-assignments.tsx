'use client';

import { useState } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FEEDBACK } from '@/lib/feedback-labels';
import { supabase } from '@/lib/supabase';
import { logClientActivity } from '@/lib/activity';

type Worker = {
  id: string;
  name: string;
  worker_type?: string | null;
  company_name?: string | null;
};

type Assignment = {
  id: string;
  worker_id: string;
  responsibility: string | null;
};

type JobAssignmentsProps = {
  jobId: string;
  organizationId: string;
  userId: string;
  workers: Worker[];
  assignments: Assignment[];
  canManage: boolean;
  isCompleted?: boolean;
  recurringSeriesId?: string | null;
  occurrenceDate?: string | null;
  onChange: () => void;
};

type AssignmentScope = 'this_job_only' | 'this_and_future' | 'entire_series';

function workerLabel(worker?: Worker) {
  if (!worker) return 'Contractor';
  const type = worker.worker_type === 'contractor' ? 'Contractor' : 'Team';
  return worker.company_name ? `${worker.name} · ${type} · ${worker.company_name}` : `${worker.name} · ${type}`;
}

export function JobAssignments({
  jobId,
  organizationId,
  userId,
  workers,
  assignments,
  canManage,
  isCompleted = false,
  recurringSeriesId = null,
  occurrenceDate = null,
  onChange
}: JobAssignmentsProps) {
  const appFeedback = useAppFeedback();
  const [workerId, setWorkerId] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const assignedIds = new Set(assignments.map((assignment) => assignment.worker_id));
  const availableWorkers = workers.filter((worker) => !assignedIds.has(worker.id));
  const busy = Boolean(busyId);

  function chooseAssignmentScope(defaultScope: AssignmentScope = 'this_job_only'): AssignmentScope | null {
    if (!recurringSeriesId || isCompleted) return 'this_job_only';
    const choice = window.prompt(
      'Apply contractor change to:\n1) This job only\n2) This and future jobs\n3) Entire series\n\nEnter 1, 2, or 3',
      '1'
    );
    if (choice === null) return null;
    if (choice.trim() === '2') return 'this_and_future';
    if (choice.trim() === '3') return 'entire_series';
    return defaultScope;
  }

  async function applySeriesAssignment(nextWorkerId: string | null, scope: AssignmentScope) {
    if (!recurringSeriesId) return false;
    const res = await fetch(`/api/recurring-jobs/${recurringSeriesId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'assign_contractor',
        assignmentScope: scope,
        preferred_contractor_id: nextWorkerId,
        jobId,
        fromDate: occurrenceDate || undefined
      })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; updatedJobCount?: number };
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to update recurring assignments.');
      return false;
    }
    appFeedback.success(`Updated contractor on ${json.updatedJobCount ?? 0} visit(s). Completed jobs were not changed.`);
    return true;
  }

  async function addAssignment() {
    if (!workerId || !canManage || busy) return;
    setBusyId('new');
    const scope = chooseAssignmentScope('this_job_only');
    if (!scope) {
      setBusyId(null);
      return;
    }
    if (recurringSeriesId && scope !== 'this_job_only') {
      const ok = await applySeriesAssignment(workerId, scope);
      setBusyId(null);
      if (ok) {
        setWorkerId('');
        setShowAdd(false);
        onChange();
      }
      return;
    }
    const { error } = await supabase.from('job_assignments').insert({
      job_id: jobId,
      worker_id: workerId,
      user_id: userId,
      organization_id: organizationId
    });
    if (error) {
      setBusyId(null);
      appFeedback.error(error.message);
      return;
    }
    // Keep canonical jobs.assigned_to aligned with the first/primary assignee.
    if (assignments.length === 0) {
      await supabase.from('jobs').update({ assigned_to: workerId }).eq('id', jobId).eq('organization_id', organizationId);
    }
    setBusyId(null);
    const worker = workers.find((item) => item.id === workerId);
    await logClientActivity(organizationId, 'job', jobId, 'worker_assigned', `Assigned ${worker?.name || 'contractor'}`, {
      worker_id: workerId
    });
    appFeedback.success('Contractor assigned. They receive job access automatically.');
    setWorkerId('');
    setShowAdd(false);
    onChange();
  }

  async function removeAssignment(assignmentId: string, workerName: string) {
    if (!canManage || busy) return;
    setBusyId(assignmentId);
    const { error } = await supabase.from('job_assignments').delete().eq('id', assignmentId);
    if (error) {
      setBusyId(null);
      appFeedback.error(error.message);
      return;
    }
    const remaining = assignments.filter((row) => row.id !== assignmentId);
    await supabase
      .from('jobs')
      .update({ assigned_to: remaining[0]?.worker_id || null })
      .eq('id', jobId)
      .eq('organization_id', organizationId);
    setBusyId(null);
    await logClientActivity(organizationId, 'job', jobId, 'worker_removed', `Removed ${workerName}`);
    appFeedback.label('removed');
    onChange();
  }

  return (
    <div className="form">
      <h3 style={{ marginTop: 0 }}>Assigned contractors</h3>
      <p className="muted">
        Contractors selected when the job was created appear here automatically and receive access when assigned.
      </p>

      {assignments.length === 0 ? (
        <p className="muted">No contractor assigned yet.</p>
      ) : (
        assignments.map((assignment) => {
          const assignedWorker = workers.find((worker) => worker.id === assignment.worker_id);
          return (
            <div key={assignment.id} className="list-row">
              <div>
                <strong>{workerLabel(assignedWorker)}</strong>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  Access granted through assignment
                </p>
              </div>
              {canManage ? (
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => void removeAssignment(assignment.id, assignedWorker?.name || 'contractor')}
                >
                  {busyId === assignment.id ? FEEDBACK.loading : 'Remove'}
                </button>
              ) : null}
            </div>
          );
        })
      )}

      {canManage && availableWorkers.length > 0 ? (
        showAdd || assignments.length === 0 ? (
          <div style={{ marginTop: 12 }}>
            <label htmlFor="add-contractor">Add another contractor</label>
            <select
              id="add-contractor"
              className="input"
              value={workerId}
              disabled={busy}
              onChange={(event) => setWorkerId(event.target.value)}
            >
              <option value="">Select contractor</option>
              {availableWorkers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {workerLabel(worker)}
                </option>
              ))}
            </select>
            <div className="button-row" style={{ marginTop: 8 }}>
              <button type="button" className="btn btn-primary" disabled={busy || !workerId} onClick={() => void addAssignment()}>
                {busyId === 'new' ? FEEDBACK.loading : assignments.length === 0 ? 'Assign contractor' : 'Add contractor'}
              </button>
              {assignments.length > 0 ? (
                <button type="button" className="btn" disabled={busy} onClick={() => setShowAdd(false)}>
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <button type="button" className="btn" style={{ marginTop: 12 }} onClick={() => setShowAdd(true)}>
            Add another contractor
          </button>
        )
      ) : null}
    </div>
  );
}
