'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { logClientActivity } from '@/lib/activity';

type Worker = { id: string; name: string };

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

export function JobAssignments({
  jobId,
  organizationId,
  userId,
  workers,
  assignments,
  canManage,
  onChange
}: JobAssignmentsProps) {
  const [workerId, setWorkerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function addAssignment() {
    if (!workerId || !canManage) return;
    setBusy(true);
    setMessage('');
    const { error } = await supabase.from('job_assignments').insert({
      job_id: jobId,
      worker_id: workerId,
      user_id: userId,
      organization_id: organizationId
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    const worker = workers.find((w) => w.id === workerId);
    await logClientActivity(organizationId, 'job', jobId, 'worker_assigned', `Assigned ${worker?.name || 'worker'}`, {
      worker_id: workerId
    });
    setWorkerId('');
    onChange();
  }

  async function removeAssignment(assignmentId: string, workerName: string) {
    if (!canManage) return;
    setBusy(true);
    const { error } = await supabase.from('job_assignments').delete().eq('id', assignmentId);
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    await logClientActivity(organizationId, 'job', jobId, 'worker_removed', `Removed ${workerName}`);
    onChange();
  }

  const assignedIds = new Set(assignments.map((a) => a.worker_id));

  return (
    <div className="form">
      <h4>Crew assignments</h4>
      {assignments.length === 0 && <p>No workers assigned yet.</p>}
      {assignments.map((a) => {
        const w = workers.find((x) => x.id === a.worker_id);
        return (
          <div key={a.id} className="list-row">
            <span>{w?.name || 'Worker'}</span>
            {canManage && (
              <button type="button" className="btn" disabled={busy} onClick={() => removeAssignment(a.id, w?.name || 'worker')}>
                Remove
              </button>
            )}
          </div>
        );
      })}
      {canManage && (
        <>
          <select className="input" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            <option value="">Add worker</option>
            {workers
              .filter((w) => !assignedIds.has(w.id))
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
          </select>
          <button type="button" className="btn btn-primary" disabled={busy || !workerId} onClick={addAssignment}>
            Assign worker
          </button>
        </>
      )}
      {message && <p>{message}</p>}
    </div>
  );
}
