'use client';

import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from './ui/button';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { normalizePlan } from '@/lib/everittos-plans';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { fetchUsageCounts, limitMessage } from '@/lib/everittos-usage';
import { ActionFeedbackBanner } from '@/components/action-feedback';
import { errorFeedback, successFeedback, type ActionFeedback } from '@/lib/action-messages';
import { validatePlanAction } from '@/lib/plan-validate';
import { ensureWorkspaceForSave } from '@/lib/workspace-client';

type JobCreatorProps = {
  onJobCreated?: (jobId: string) => void;
};

export function JobCreator({ onJobCreated }: JobCreatorProps) {
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);

  async function createJob(event?: FormEvent) {
    event?.preventDefault();

    if (!title.trim()) {
      setFeedback(errorFeedback('Add a job title first.'));
      return;
    }

    setLoading(true);
    setFeedback(null);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      setFeedback(errorFeedback('Sign in to create jobs.'));
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('role, plan').eq('id', user.id).maybeSingle();
    const role = normalizeRole(profile?.role);
    if (!isManagerRole(role)) {
      setPermissionBlocked(true);
      setLoading(false);
      setFeedback(errorFeedback('Only owners, admins, and managers can create jobs.'));
      return;
    }

    const org = await ensureWorkspaceForSave(user.id);
    if (!org?.organizationId) {
      setLoading(false);
      setFeedback(
        errorFeedback('Workspace setup is still finishing. Wait a moment and try again, or refresh the page.')
      );
      return;
    }

    const { plan: orgPlan } = await resolveOrganizationPlan(supabase, user.id);
    const usage = await fetchUsageCounts(user.id, org.organizationId);
    const check = validatePlanAction({ plan: orgPlan, resource: 'jobs', currentCount: usage.jobs });
    if (!check.allowed) {
      setLoading(false);
      setFeedback(errorFeedback(check.message || limitMessage('jobs', orgPlan)));
      return;
    }

    const serverCheck = await fetch('/api/plan/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'jobs' })
    });
    const serverJson = await serverCheck.json();
    if (!serverJson.allowed) {
      setLoading(false);
      setFeedback(errorFeedback(serverJson.message || 'Plan limit reached.'));
      return;
    }

    const createRes = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        customer_name: customerName.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        status: 'new'
      })
    });
    const createJson = (await createRes.json()) as { job?: { id: string }; error?: string; message?: string };

    setLoading(false);

    if (!createRes.ok) {
      setFeedback(errorFeedback(createJson.error || 'Unable to save job.'));
      return;
    }

    const createdJob = createJson.job;

    if (!createdJob?.id) {
      setFeedback(errorFeedback('Job could not be saved. Please try again.'));
      return;
    }

    void fetch('/api/integrations/google-calendar/sync-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: createdJob.id })
    });

    setTitle('');
    setAddress('');
    setCustomerName('');
    setPhone('');
    setNotes('');
    setFeedback(successFeedback(createJson.message || 'Job saved successfully.'));
    onJobCreated?.(createdJob.id);
  }

  if (permissionBlocked) {
    return (
      <div className="card">
        <h3>Create a job</h3>
        <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />
        <p>Only owners, admins, and managers can create new jobs.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Create a job</h3>
      <form className="form" onSubmit={createJob}>
        <input
          className="input"
          placeholder="Job title *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <input
          className="input"
          placeholder="Customer name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
        />
        <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className="input" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <textarea className="input" placeholder="Notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save job'}
        </Button>
        <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />
      </form>
    </div>
  );
}
