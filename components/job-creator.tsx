'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from './ui/button';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { normalizePlan } from '@/lib/everittos-plans';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { fetchUsageCounts, limitMessage } from '@/lib/everittos-usage';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FEEDBACK } from '@/lib/feedback-labels';
import { validatePlanAction } from '@/lib/plan-validate';
import { ensureWorkspaceForSave } from '@/lib/workspace-client';

type JobCreatorProps = {
  onJobCreated?: (jobId: string) => void;
};

type TeamOption = {
  user_id: string;
  role: string;
  profiles?: {
    email?: string | null;
    full_name?: string | null;
  } | null;
};

export function JobCreator({ onJobCreated }: JobCreatorProps) {
  const searchParams = useSearchParams();
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const appFeedback = useAppFeedback();

  useEffect(() => {
    const preassigned = searchParams.get('assigned_to');
    if (preassigned) setAssignedTo(preassigned);
  }, [searchParams]);

  useEffect(() => {
    async function loadTeam() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;

      const workspace = await ensureWorkspaceForSave(user.id);
      if (!workspace.ok) return;

      const { data } = await supabase
        .from('organization_members')
        .select('user_id, role, profiles(email, full_name)')
        .eq('organization_id', workspace.workspace.organizationId)
        .eq('active', true)
        .in('role', ['manager', 'employee', 'contractor', 'staff', 'crew_lead']);

      setTeamMembers((data || []) as TeamOption[]);
    }

    void loadTeam();
  }, []);

  async function createJob(event?: FormEvent) {
    event?.preventDefault();

    if (loading) return;

    if (!title.trim()) {
      appFeedback.error('Add a job title first.');
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
        assigned_to: assignedTo || null,
        status: 'new'
      })
    });
    const createJson = (await createRes.json()) as { job?: { id: string }; error?: string; message?: string };

    setLoading(false);

    if (!createRes.ok) {
      console.error('[everittos-job] create failed', {
        status: createRes.status,
        error: createJson.error
      });
      appFeedback.error(createJson.error || 'Unable to save job.');
      return;
    }

    const createdJob = createJson.job;

    if (!createdJob?.id) {
      appFeedback.error('Job could not be saved. Please try again.');
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
    setAssignedTo('');
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
      <p className="muted">Create the work record first. You can assign it to a team member now or later.</p>
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
        <label htmlFor="job-assignment">Assign to</label>
        <select id="job-assignment" className="input" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
          <option value="">Needs assignment</option>
          {teamMembers.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.profiles?.full_name || member.profiles?.email || member.user_id} · {normalizeRole(member.role)}
            </option>
          ))}
        </select>
        <p className="muted">You can assign this job now or leave it unassigned for the team schedule.</p>
        <textarea className="input" placeholder="Notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button className="btn-primary" type="submit" disabled={loading}>
          {loading ? FEEDBACK.loading : 'Save job'}
        </Button>
      </form>
    </div>
  );
}
