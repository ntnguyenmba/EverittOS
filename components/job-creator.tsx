'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from './ui/button';
import { isManagerRole, normalizeRole } from '@/lib/roles';
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

type WorkerOption = {
  id: string;
  name: string;
  auth_user_id?: string | null;
};

function teamLabel(member: TeamOption): string {
  return member.profiles?.full_name || member.profiles?.email || member.user_id;
}

function teamSubLabel(member: TeamOption): string {
  return `${normalizeRole(member.role)}${member.profiles?.email ? ` · ${member.profiles.email}` : ''}`;
}

export function JobCreator({ onJobCreated }: JobCreatorProps) {
  const searchParams = useSearchParams();
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamOption[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [workerIds, setWorkerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const appFeedback = useAppFeedback();

  useEffect(() => {
    const preassigned = searchParams.get('assigned_to');
    if (preassigned) setAssignedTo(preassigned);
  }, [searchParams]);

  useEffect(() => {
    async function loadAssignmentOptions() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;

      const workspace = await ensureWorkspaceForSave(user.id);
      if (!workspace.ok) return;
      const organizationId = workspace.workspace.organizationId;

      const [{ data: members }, { data: workerRows }] = await Promise.all([
        supabase
          .from('organization_members')
          .select('user_id, role, profiles(email, full_name)')
          .eq('organization_id', organizationId)
          .eq('active', true)
          .in('role', ['owner', 'admin', 'manager', 'employee', 'contractor', 'staff', 'crew_lead']),
        supabase
          .from('workers')
          .select('id, name, auth_user_id')
          .eq('organization_id', organizationId)
          .order('name')
      ]);

      setTeamMembers((members || []) as TeamOption[]);
      setWorkers((workerRows || []) as WorkerOption[]);
    }

    void loadAssignmentOptions();
  }, []);

  function toggleWorker(workerId: string) {
    setWorkerIds((ids) => (ids.includes(workerId) ? ids.filter((id) => id !== workerId) : [...ids, workerId]));
  }

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

    if (!createRes.ok) {
      setLoading(false);
      console.error('[everittos-job] create failed', {
        status: createRes.status,
        error: createJson.error
      });
      appFeedback.error(createJson.error || 'Unable to save job.');
      return;
    }

    const createdJob = createJson.job;

    if (!createdJob?.id) {
      setLoading(false);
      appFeedback.error('Job could not be saved. Please try again.');
      return;
    }

    if (workerIds.length > 0) {
      const { error: assignmentError } = await supabase.from('job_assignments').insert(
        workerIds.map((workerId) => ({
          job_id: createdJob.id,
          worker_id: workerId,
          user_id: user.id,
          organization_id: org.organizationId
        }))
      );
      if (assignmentError) {
        appFeedback.error('Job was saved, but crew assignment failed. Open the job to assign crew.');
      }
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
    setAssignedTo('');
    setWorkerIds([]);
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
      <p className="muted">Create the work record first. Add a primary teammate, outside crew, or both.</p>
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

        <div>
          <label>Primary teammate</label>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <label className="list-row" style={{ cursor: 'pointer' }}>
              <span>
                <strong>Needs assignment</strong>
                <span className="muted" style={{ display: 'block' }}>Keep this job open for scheduling later.</span>
              </span>
              <input type="radio" name="assigned-to" value="" checked={!assignedTo} onChange={() => setAssignedTo('')} />
            </label>
            {teamMembers.map((member) => (
              <label key={member.user_id} className="list-row" style={{ cursor: 'pointer' }}>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ overflowWrap: 'anywhere' }}>{teamLabel(member)}</strong>
                  <span className="muted" style={{ display: 'block', overflowWrap: 'anywhere' }}>{teamSubLabel(member)}</span>
                </span>
                <input
                  type="radio"
                  name="assigned-to"
                  value={member.user_id}
                  checked={assignedTo === member.user_id}
                  onChange={() => setAssignedTo(member.user_id)}
                />
              </label>
            ))}
          </div>
        </div>

        <div>
          <label>Additional crew or outside help</label>
          {workers.length === 0 ? (
            <p className="muted" style={{ marginTop: 8 }}>Add workers first if you want to assign outside or non-login crew.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {workers.map((worker) => (
                <label key={worker.id} className="list-row" style={{ cursor: 'pointer' }}>
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ overflowWrap: 'anywhere' }}>{worker.name}</strong>
                    <span className="muted" style={{ display: 'block' }}>
                      {worker.auth_user_id ? 'Linked team worker' : 'Outside or field worker'}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={workerIds.includes(worker.id)}
                    onChange={() => toggleWorker(worker.id)}
                  />
                </label>
              ))}
            </div>
          )}
          <p className="muted" style={{ marginTop: 8 }}>
            Use primary teammate for team dashboard ownership. Use crew for helpers, contractors, or outside field workers.
          </p>
        </div>

        <textarea className="input" placeholder="Notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button className="btn-primary" type="submit" disabled={loading}>
          {loading ? FEEDBACK.loading : 'Save job'}
        </Button>
      </form>
    </div>
  );
}
