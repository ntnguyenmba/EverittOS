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

type AssignmentScope = 'this_job_only' | 'this_and_future';

type ManualContractorForm = {
  name: string;
  phone: string;
  email: string;
  companyName: string;
};

const EMPTY_MANUAL_CONTRACTOR: ManualContractorForm = {
  name: '',
  phone: '',
  email: '',
  companyName: ''
};

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
  const [showManual, setShowManual] = useState(false);
  const [manualContractor, setManualContractor] = useState<ManualContractorForm>(EMPTY_MANUAL_CONTRACTOR);
  const assignedIds = new Set(assignments.map((assignment) => assignment.worker_id));
  const availableWorkers = workers.filter((worker) => !assignedIds.has(worker.id));
  const busy = Boolean(busyId);

  function chooseAssignmentScope(defaultScope: AssignmentScope = 'this_job_only'): AssignmentScope | null {
    if (!recurringSeriesId || isCompleted) return 'this_job_only';
    const choice = window.prompt(
      'Where should this contractor change apply?\n\n1) This visit only\nOnly this scheduled visit changes.\n\n2) This visit and all future visits\nPast visits stay unchanged.\n\nEnter 1 or 2',
      '1'
    );
    if (choice === null) return null;
    if (choice.trim() === '2') return 'this_and_future';
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

  async function assignWorker(nextWorkerId: string, workerName: string) {
    const scope = chooseAssignmentScope('this_job_only');
    if (!scope) return false;

    if (recurringSeriesId && scope !== 'this_job_only') {
      return applySeriesAssignment(nextWorkerId, scope);
    }

    const { error } = await supabase.from('job_assignments').insert({
      job_id: jobId,
      worker_id: nextWorkerId,
      user_id: userId,
      organization_id: organizationId
    });
    if (error) {
      appFeedback.error(error.message);
      return false;
    }

    if (assignments.length === 0) {
      await supabase
        .from('jobs')
        .update({ assigned_to: nextWorkerId })
        .eq('id', jobId)
        .eq('organization_id', organizationId);
    }

    await logClientActivity(organizationId, 'job', jobId, 'worker_assigned', `Assigned ${workerName}`, {
      worker_id: nextWorkerId
    });
    return true;
  }

  async function addAssignment() {
    if (!workerId || !canManage || busy) return;
    setBusyId('new');
    const worker = workers.find((item) => item.id === workerId);
    const ok = await assignWorker(workerId, worker?.name || 'contractor');
    setBusyId(null);
    if (!ok) return;

    appFeedback.success('Contractor assigned. Account access is granted only when the contractor has a login.');
    setWorkerId('');
    setShowAdd(false);
    onChange();
  }

  async function addManualContractor() {
    if (!canManage || busy) return;
    const name = manualContractor.name.trim();
    if (!name) {
      appFeedback.error('Enter the contractor name.');
      return;
    }

    setBusyId('manual');
    const res = await fetch('/api/contractors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        phone: manualContractor.phone.trim() || null,
        email: manualContractor.email.trim() || null,
        companyName: manualContractor.companyName.trim() || null,
        contractorClassification: 'contractor'
      })
    });
    const json = (await res.json().catch(() => ({}))) as {
      contractor?: Worker;
      error?: string;
    };

    if (!res.ok || !json.contractor?.id) {
      setBusyId(null);
      appFeedback.error(json.error || 'Unable to add contractor.');
      return;
    }

    const ok = await assignWorker(json.contractor.id, json.contractor.name || name);
    setBusyId(null);
    if (!ok) return;

    setManualContractor(EMPTY_MANUAL_CONTRACTOR);
    setShowManual(false);
    setShowAdd(false);
    appFeedback.success('Manual contractor added and assigned. No EverittOS account is required.');
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
        Assign an existing contractor or add someone manually. Manual contractors do not need an EverittOS account and still count in job history and contractor metrics.
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
                  {assignedWorker ? 'Included in job and contractor metrics' : 'Assigned contractor'}
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

      {canManage ? (
        <div style={{ marginTop: 12 }}>
          {!showAdd && !showManual ? (
            <div className="button-row">
              <button type="button" className="btn" onClick={() => setShowAdd(true)}>
                Assign existing contractor
              </button>
              <button type="button" className="btn" onClick={() => setShowManual(true)}>
                Add manual contractor
              </button>
            </div>
          ) : null}

          {showAdd ? (
            <div className="card" style={{ marginTop: 10 }}>
              <label htmlFor="add-contractor">Existing contractor</label>
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
              {availableWorkers.length === 0 ? <p className="muted">No other active contractors found.</p> : null}
              <div className="button-row" style={{ marginTop: 8 }}>
                <button type="button" className="btn btn-primary" disabled={busy || !workerId} onClick={() => void addAssignment()}>
                  {busyId === 'new' ? FEEDBACK.loading : 'Assign contractor'}
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => setShowAdd(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {showManual ? (
            <div className="card" style={{ marginTop: 10 }}>
              <h4 style={{ marginTop: 0 }}>Manual contractor</h4>
              <p className="muted">Add and assign someone without creating a login.</p>
              <div className="grid-2">
                <label>
                  Name
                  <input
                    className="input"
                    value={manualContractor.name}
                    onChange={(event) => setManualContractor({ ...manualContractor, name: event.target.value })}
                  />
                </label>
                <label>
                  Phone
                  <input
                    className="input"
                    value={manualContractor.phone}
                    onChange={(event) => setManualContractor({ ...manualContractor, phone: event.target.value })}
                    placeholder="Optional"
                  />
                </label>
                <label>
                  Email
                  <input
                    className="input"
                    type="email"
                    value={manualContractor.email}
                    onChange={(event) => setManualContractor({ ...manualContractor, email: event.target.value })}
                    placeholder="Optional"
                  />
                </label>
                <label>
                  Company
                  <input
                    className="input"
                    value={manualContractor.companyName}
                    onChange={(event) => setManualContractor({ ...manualContractor, companyName: event.target.value })}
                    placeholder="Optional"
                  />
                </label>
              </div>
              <div className="button-row" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !manualContractor.name.trim()}
                  onClick={() => void addManualContractor()}
                >
                  {busyId === 'manual' ? FEEDBACK.loading : 'Add and assign'}
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => setShowManual(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
