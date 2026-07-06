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
  onChange: () => void;
};

function workerLabel(worker?: Worker) {
  if (!worker) return 'Team member';
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
  onChange
}: JobAssignmentsProps) {
  const appFeedback = useAppFeedback();
  const [workerId, setWorkerId] = useState('');
  const [busy, setBusy] = useState(false);

  async function addAssignment() {
    if (!workerId || !canManage || busy) return;
    setBusy(true);
    const { error } = await supabase.from('job_assignments').insert({
      job_id: jobId,
      worker_id: workerId,
      user_id: userId,
      organization_id: organizationId
    });
    setBusy(false);
    if (error) {
      appFeedback.error(error.message);
      return;
    }
    const worker = workers.find((w) => w.id === workerId);
    await logClientActivity(organizationId, 'job', jobId, 'worker_assigned', `Assigned ${worker?.name || 'team member'}`, {
      worker_id: workerId
    });
    appFeedback.success('Assigned team updated.');
    setWorkerId('');
    onChange();
  }

  async function removeAssignment(assignmentId: string, workerName: string) {
    if (!canManage || busy) return;
    setBusy(true);
    const { error } = await supabase.from('job_assignments').delete().eq('id', assignmentId);
    setBusy(false);
    if (error) {
      appFeedback.error(error.message);
      return;
    }
    await logClientActivity(organizationId, 'job', jobId, 'worker_removed', `Removed ${workerName}`);
    appFeedback.label('removed');
    onChange();
  }

  const assignedIds = new Set(assignments.map((a) => a.worker_id));

  return (
    <div className="form">
      <h4>Assigned team</h4>
      <p className="muted">Assign employees or contractors who will work on this job.</p>
      {assignments.length === 0 && <p>No employees or contractors assigned yet.</p>}
      {assignments.map((a) => {
        const w = workers.find((x) => x.id === a.worker_id);
        return (
          <div key={a.id} className="list-row">
            <span>{workerLabel(w)}</span>
            {canManage && (
              <button type="button" className="btn" disabled={busy} onClick={() => removeAssignment(a.id, w?.name || 'team member')}>
                Remove
              </button>
            )}
          </div>
        );
      })}
      {canManage && (
        <>
          <select className="input" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            <option value="">Add employee or contractor</option>
            {workers
              .filter((w) => !assignedIds.has(w.id))
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {workerLabel(w)}
                </option>
              ))}
          </select>
          <button type="button" className="btn btn-primary" disabled={busy || !workerId} onClick={() => void addAssignment()}>
            {busy ? FEEDBACK.loading : 'Assign to job'}
          </button>
        </>
      )}
    </div>
  );
}
