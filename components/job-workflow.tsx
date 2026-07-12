'use client';

import { useCallback, useEffect, useState } from 'react';

type WorkflowStep = {
  id: string;
  title: string;
  description: string | null;
  step_type: string;
  required: boolean;
  sort_order: number;
};

type ProgressRow = {
  workflow_step_id: string;
  completed: boolean;
  note: string | null;
};

type JobWorkflowProps = {
  jobId: string;
  canManage: boolean;
  canComplete: boolean;
  hasWorkflowFeature: boolean;
};

export function JobWorkflow({ jobId, canManage, canComplete, hasWorkflowFeature }: JobWorkflowProps) {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [progress, setProgress] = useState<Record<string, ProgressRow>>({});
  const [workflows, setWorkflows] = useState<{ id: string; name: string }[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/jobs/${jobId}/workflow`);
    const json = await res.json();
    setSteps(json.steps || []);
    const map: Record<string, ProgressRow> = {};
    (json.progress || []).forEach((row: ProgressRow & { workflow_step_id: string }) => {
      map[row.workflow_step_id] = row;
    });
    setProgress(map);

    if (canManage && hasWorkflowFeature) {
      const wfRes = await fetch('/api/workflows');
      const wfJson = await wfRes.json();
      setWorkflows((wfJson.workflows || []).map((w: { id: string; name: string }) => ({ id: w.id, name: w.name })));
    } else {
      setWorkflows([]);
    }
    setLoading(false);
  }, [canManage, hasWorkflowFeature, jobId]);

  useEffect(() => {
    if (hasWorkflowFeature) void load();
  }, [hasWorkflowFeature, load]);

  async function attachWorkflow() {
    if (!selectedWorkflow) return;
    const res = await fetch(`/api/jobs/${jobId}/workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowTemplateId: selectedWorkflow })
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error || 'Unable to attach workflow.');
      return;
    }
    setMessage('Workflow attached.');
    void load();
  }

  async function toggleStep(stepId: string, step: WorkflowStep) {
    const noteInput = step.step_type === 'note' ? prompt('Add a note for this step') : '';
    if (step.step_type === 'note' && !noteInput?.trim()) {
      setMessage('This step requires a note.');
      return;
    }

    const res = await fetch(`/api/jobs/${jobId}/workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stepId,
        completed: !progress[stepId]?.completed,
        note: noteInput || undefined
      })
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error || 'Unable to update step.');
      return;
    }
    void load();
  }

  if (!hasWorkflowFeature) {
    return (
      <div className="card" style={{ marginTop: 18 }}>
        <h3>Workflow</h3>
        <p className="muted">Workflows are available on Growth and higher.</p>
      </div>
    );
  }

  if (loading) return <div className="card">Loading workflow...</div>;

  const completedCount = steps.filter((s) => progress[s.id]?.completed).length;

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <h3>Workflow progress</h3>
      {steps.length === 0 ? <p className="muted">No workflow attached to this job.</p> : null}
      {steps.length > 0 ? (
        <p className="muted">
          {completedCount} of {steps.length} steps complete
        </p>
      ) : null}

      {canManage && workflows.length > 0 && steps.length === 0 ? (
        <div className="inline-actions" style={{ marginBottom: 12 }}>
          <select className="input" value={selectedWorkflow} onChange={(e) => setSelectedWorkflow(e.target.value)}>
            <option value="">Select workflow</option>
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary" onClick={attachWorkflow}>
            Attach
          </button>
        </div>
      ) : null}

      {steps.map((step) => (
        <div key={step.id} className="checklist-row">
          <input
            type="checkbox"
            checked={Boolean(progress[step.id]?.completed)}
            disabled={!canComplete}
            onChange={() => toggleStep(step.id, step)}
          />
          <div>
            <strong>{step.title}</strong>
            <p className="muted">
              {step.step_type}
              {step.required ? ' · required' : ''}
            </p>
            {progress[step.id]?.note ? <p className="muted">{progress[step.id]?.note}</p> : null}
          </div>
        </div>
      ))}

      {message ? <p>{message}</p> : null}
    </div>
  );
}
