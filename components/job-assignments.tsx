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
  onChange: () => void;
};

function workerLabel(worker?: Worker) {
  if (!worker) return 'Team member';
  const type = worker.worker_type === 'contractor' ? 'Contractor' : 'Team';
  return worker.company_name ? `${worker.name} - ${type} - ${worker.company_name}` : `${worker.name} - ${type}`;
}

export function JobAssignments({
  jobId,
  organizationId,
  userId,
  workers,
  assignments,
  canManage,
  isCompleted = false,
  onChange
}: JobAssignmentsProps) {
  const appFeedback = useAppFeedback();
  const [workerId, setWorkerId] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const assignedIds = new Set(assignments.map((assignment) => assignment.worker_id));
  const availableWorkers = workers.filter((worker) => !assignedIds.has(worker.id));
  const busy = Boolean(busyId);

  async function addAssignment() {
    if (!workerId || !canManage || busy) return;
    setBusyId('new');
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
    await logClientActivity(organizationId, 'job', jobId, 'worker_assigned', `Assigned ${worker?.name || 'team member'}`, {
      worker_id: workerId
    });
    appFeedback.success('Assigned team updated.');
    setWorkerId('');
    onChange();
  }

  async function replaceAssignment(assignment: Assignment, nextWorkerId: string) {
    if (!canManage || busy || !nextWorkerId || nextWorkerId === assignment.worker_id) return;
    setBusyId(assignment.id);
    const previousWorker = workers.find((worker) => worker.id === assignment.worker_id);
    const nextWorker = workers.find((worker) => worker.id === nextWorkerId);
    const { error } = await supabase
      .from('job_assignments')
      .update({ worker_id: nextWorkerId })
      .eq('id', assignment.id)
      .eq('job_id', jobId)
      .eq('organization_id', organizationId);
    if (error) {
      setBusyId(null);
      appFeedback.error(error.message);
      return;
    }
    await supabase.from('jobs').update({ assigned_to: nextWorkerId }).eq('id', jobId).eq('organization_id', organizationId);
    setBusyId(null);
    await logClientActivity(
      organizationId,
      'job',
      jobId,
      'worker_assignment_corrected',
      `Changed assignment from ${previousWorker?.name || 'team member'} to ${nextWorker?.name || 'team member'}`,
      { previous_worker_id: assignment.worker_id, worker_id: nextWorkerId }
    );
    appFeedback.success(isCompleted ? 'Completed job assignment corrected.' : 'Assigned team updated.');
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
      <h4>Assigned team</h4>
      <p className="muted">
        Team members assigned to this job. {isCompleted && canManage ? 'Completed job assignments can still be corrected here.' : ''}
      </p>
      {assignments.length === 0 ? (
        <p className="muted">No contractor selected yet. Assign someone below only if this job still needs a worker.</p>
      ) : null}
      {assignments.map((assignment) => {
        const assignedWorker = workers.find((worker) => worker.id === assignment.worker_id);
        const replacementOptions = workers.filter(
          (worker) => worker.id === assignment.worker_id || !assignedIds.has(worker.id)
        );
        return (
          <div key={assignment.id} className="list-row">
            {canManage ? (
              <select
                className="input"
                aria-label="Assigned team member"
                value={assignment.worker_id}
                disabled={busy}
                onChange={(event) => void replaceAssignment(assignment, event.target.value)}
              >
                {replacementOptions.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {workerLabel(worker)}
                  </option>
                ))}
              </select>
            ) : (
              <span>{workerLabel(assignedWorker)}</span>
            )}
            {canManage ? (
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void removeAssignment(assignment.id, assignedWorker?.name || 'team member')}
              >
                {busyId === assignment.id ? FEEDBACK.loading : 'Remove'}
              </button>
            ) : null}
          </div>
        );
      })}
      {canManage && availableWorkers.length > 0 && assignments.length === 0 ? (
        <>
          <select className="input" value={workerId} disabled={busy} onChange={(event) => setWorkerId(event.target.value)}>
            <option value="">Select contractor or team member</option>
            {availableWorkers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {workerLabel(worker)}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary" disabled={busy || !workerId} onClick={() => void addAssignment()}>
            {busyId === 'new' ? FEEDBACK.loading : 'Assign to job'}
          </button>
        </>
      ) : null}
      {canManage && availableWorkers.length > 0 && assignments.length > 0 ? (
        <details>
          <summary>Add another team member</summary>
          <select className="input" value={workerId} disabled={busy} onChange={(event) => setWorkerId(event.target.value)}>
            <option value="">Select additional team member</option>
            {availableWorkers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {workerLabel(worker)}
              </option>
            ))}
          </select>
          <button type="button" className="btn" disabled={busy || !workerId} onClick={() => void addAssignment()}>
            {busyId === 'new' ? FEEDBACK.loading : 'Add to job'}
          </button>
        </details>
      ) : null}
    </div>
  );
}
