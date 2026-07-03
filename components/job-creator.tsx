'use client';

import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from './ui/button';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { fetchUsageCounts, limitMessage } from '@/lib/everittos-usage';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FEEDBACK } from '@/lib/feedback-labels';
import { validatePlanAction } from '@/lib/plan-validate';
import { validateAssignedEmail } from '@/lib/job-assigned-email';
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
  const [assignedEmail, setAssignedEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const appFeedback = useAppFeedback();

  async function createJob(event?: FormEvent) {
    event?.preventDefault();

    if (loading) return;

    if (!title.trim()) {
      appFeedback.error('Add a job title first.');
      return;
    }

    const emailCheck = validateAssignedEmail(assignedEmail);
    if (!emailCheck.ok) {
      appFeedback.error(emailCheck.error);
      return;
    }

    setLoading(true);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      appFeedback.error('Sign in to create jobs.');
      return;
    }

    const workspace = await ensureWorkspaceForSave(user.id);
    if (!workspace.ok) {
      setLoading(false);
      appFeedback.error(workspace.error);
      return;
    }
    const org = workspace.workspace;

    const { data: profile } = await supabase.from('profiles').select('role, plan').eq('id', user.id).maybeSingle();
    const role = normalizeRole(org.role || profile?.role);
    if (!isManagerRole(role)) {
      setPermissionBlocked(true);
      setLoading(false);
      appFeedback.error('You do not have access to create jobs on this account.');
      return;
    }

    const { plan: orgPlan } = await resolveOrganizationPlan(supabase, user.id);
    const usage = await fetchUsageCounts(user.id, org.organizationId);
    const check = validatePlanAction({ plan: orgPlan, resource: 'jobs', currentCount: usage.jobs });
    if (!check.allowed) {
      setLoading(false);
      appFeedback.error(check.message || limitMessage('jobs', orgPlan));
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
      appFeedback.error(serverJson.message || 'Plan limit reached.');
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
        assigned_email: emailCheck.email,
        status: 'new'
      })
    });
    const createJson = (await createRes.json()) as { job?: { id: string }; error?: string; message?: string };

    if (!createRes.ok) {
      setLoading(false);
      appFeedback.error(createJson.error || 'Unable to save job.');
      return;
    }

    const createdJob = createJson.job;

    if (!createdJob?.id) {
      setLoading(false);
      appFeedback.error('Job could not be saved. Please try again.');
      return;
    }

    void fetch('/api/integrations/google-calendar/sync-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: createdJob.id })
    });

    setLoading(false);
    setTitle('');
    setAddress('');
    setCustomerName('');
    setPhone('');
    setNotes('');
    setAssignedEmail('');
    appFeedback.created();
    onJobCreated?.(createdJob.id);
  }

  if (permissionBlocked) {
    return (
      <div className="card">
        <h3>Create a job</h3>
        <p>You do not have access to create jobs on this account.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Create a job</h3>
      <form className="form" onSubmit={createJob}>
        <input className="input" placeholder="Job title *" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input className="input" placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className="input" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <label htmlFor="job-assigned-email">Assigned email</label>
        <input
          id="job-assigned-email"
          className="input"
          type="email"
          placeholder="name@company.com"
          value={assignedEmail}
          onChange={(e) => setAssignedEmail(e.target.value)}
          autoComplete="email"
        />
        <p className="muted">Optional. Who should receive this job. No People record required.</p>
        <textarea className="input" placeholder="Notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button className="btn-primary" type="submit" disabled={loading}>
          {loading ? FEEDBACK.loading : 'Save job'}
        </Button>
      </form>
    </div>
  );
}
