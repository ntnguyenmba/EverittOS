'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/empty-state';
import { AppShell } from '@/components/app-shell';
import { PlanLockedMessage } from '@/components/plan-locked-message';
import { useAsyncAction } from '@/hooks/use-async-action';
import { FEEDBACK } from '@/lib/feedback-labels';
import { EMPTY_COPY } from '@/lib/empty-copy';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { supabase } from '@/lib/supabase';

type Workflow = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  workflow_steps?: { id: string; title: string; sort_order: number; step_type: string }[];
};

export default function WorkflowsPage() {
  const router = useRouter();
  const { busy, runResponse, buttonLabel } = useAsyncAction();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [name, setName] = useState('');
  const [stepTitle, setStepTitle] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
    setPlan(normalizePlan(profile?.plan));
    const res = await fetch('/api/workflows');
    const json = await res.json();
    setCanManage(Boolean(json.canManage));
    setWorkflows(json.workflows || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [router]);

  async function createWorkflow() {
    const res = await runResponse(
      () =>
        fetch('/api/workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            steps: stepTitle ? [{ title: stepTitle, step_type: 'checklist' }] : []
          })
        }),
      'created'
    );
    if (!res) return;
    setName('');
    setStepTitle('');
    load();
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/workflows/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active })
    });
    load();
  }

  async function addStep(workflowId: string) {
    const title = prompt('Step title');
    if (!title?.trim()) return;
    await fetch(`/api/workflows/${workflowId}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    load();
  }

  async function reorderStep(workflowId: string, stepId: string, direction: 'up' | 'down') {
    await fetch(`/api/workflows/${workflowId}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reorder: [{ stepId, direction }] })
    });
    load();
  }

  if (loading) {
    return (
      <AppShell plan={plan}>
        <p>Loading workflows...</p>
      </AppShell>
    );
  }

  return (
    <AppShell plan={plan}>
      <h2>Workflows</h2>
        <p className="muted">Job workflows and checklist templates for Growth and higher.</p>

        {!limitsForPlan(plan).workflowCustomization ? (
          <PlanLockedMessage feature="Workflows" requiredPlan="Growth" />
        ) : (
          <>
            {canManage ? (
              <div className="settings-card form">
                <h3>Create workflow</h3>
                <input className="input" placeholder="Workflow name" value={name} onChange={(e) => setName(e.target.value)} />
                <input className="input" placeholder="First step (optional)" value={stepTitle} onChange={(e) => setStepTitle(e.target.value)} />
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void createWorkflow()}>
                  {buttonLabel('Create workflow', FEEDBACK.loading)}
                </button>
              </div>
            ) : null}

            {workflows.length === 0 ? (
              <div className="settings-card">
                <EmptyState title={EMPTY_COPY.workflows.title} description={EMPTY_COPY.workflows.description} />
              </div>
            ) : null}

            {workflows.map((wf) => (
              <div key={wf.id} className="settings-card">
                <div className="list-row">
                  <div>
                    <strong>{wf.name}</strong>
                    <p className="muted">{wf.description || 'No description'}</p>
                  </div>
                  {canManage ? (
                    <button type="button" className="btn" disabled={busy} onClick={() => toggleActive(wf.id, wf.active)}>
                      {wf.active ? 'Deactivate' : 'Activate'}
                    </button>
                  ) : null}
                </div>
                {(wf.workflow_steps || [])
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((step) => (
                    <div key={step.id} className="checklist-row">
                      <span>{step.title}</span>
                      <span className="muted">{step.step_type}</span>
                      {canManage ? (
                        <span className="inline-actions">
                          <button type="button" className="btn" disabled={busy} onClick={() => reorderStep(wf.id, step.id, 'up')}>
                            Up
                          </button>
                          <button type="button" className="btn" disabled={busy} onClick={() => reorderStep(wf.id, step.id, 'down')}>
                            Down
                          </button>
                        </span>
                      ) : null}
                    </div>
                  ))}
                {canManage ? (
                  <button type="button" className="btn" disabled={busy} onClick={() => addStep(wf.id)}>
                    Add step
                  </button>
                ) : null}
              </div>
            ))}
          </>
        )}

        <Link href="/settings" className="btn">
          Back to settings
        </Link>
    </AppShell>
  );
}
