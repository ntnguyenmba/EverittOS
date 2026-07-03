'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
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
  source?: 'member' | 'linked_worker';
  active_jobs?: number | null;
  due_today_jobs?: number | null;
  profiles?: {
    email?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
    photo_url?: string | null;
  } | null;
};

type WorkerOption = {
  id: string;
  name: string;
  role?: string | null;
  auth_user_id?: string | null;
};

function teamLabel(member: TeamOption): string {
  return member.profiles?.full_name || member.profiles?.email || member.user_id;
}

function teamSubLabel(member: TeamOption): string {
  const label = normalizeRole(member.role);
  const detail = member.profiles?.email || (member.source === 'linked_worker' ? 'Linked worker account' : 'Team member');
  return `${label} · ${detail}`;
}

function initials(value: string): string {
  return (
    value
      .replace(/@.*/, '')
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('') || 'TM'
  ).toUpperCase();
}

function avatarUrl(member: TeamOption): string | null {
  return member.profiles?.avatar_url || member.profiles?.photo_url || null;
}

function assignmentStatus(member: TeamOption): string {
  const active = member.active_jobs || 0;
  const dueToday = member.due_today_jobs || 0;
  if (active > 0) return `${active} active`;
  if (dueToday > 0) return `${dueToday} today`;
  return 'Available';
}

function selectedCrewText(count: number): string {
  if (count === 0) return 'No extra crew selected';
  if (count === 1) return '1 crew member selected';
  return `${count} crew members selected`;
}

function mergeMembersWithLinkedWorkers(members: TeamOption[], workers: WorkerOption[]): TeamOption[] {
  const byUserId = new Map<string, TeamOption>();
  for (const member of members) {
    byUserId.set(member.user_id, { ...member, source: 'member' });
  }

  for (const worker of workers) {
    if (!worker.auth_user_id || byUserId.has(worker.auth_user_id)) continue;
    byUserId.set(worker.auth_user_id, {
      user_id: worker.auth_user_id,
      role: worker.role || 'employee',
      source: 'linked_worker',
      profiles: {
        full_name: worker.name,
        email: null,
        avatar_url: null,
        photo_url: null
      }
    });
  }

  return Array.from(byUserId.values()).sort((a, b) => teamLabel(a).localeCompare(teamLabel(b)));
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
  const [teamSearch, setTeamSearch] = useState('');
  const [crewSearch, setCrewSearch] = useState('');
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

      const [{ data: members }, { data: workerRows }, { data: jobs }] = await Promise.all([
        supabase
          .from('organization_members')
          .select('user_id, role, profiles(email, full_name, avatar_url, photo_url)')
          .eq('organization_id', organizationId)
          .eq('active', true)
          .in('role', ['owner', 'admin', 'manager', 'employee', 'contractor', 'staff', 'crew_lead']),
        supabase.from('workers').select('id, name, role, auth_user_id').eq('organization_id', organizationId).order('name'),
        supabase.from('jobs').select('assigned_to, status, due_date, scheduled_start').eq('organization_id', organizationId)
      ]);

      const workerOptions = (workerRows || []) as WorkerOption[];
      const workerUserById = new Map(workerOptions.map((worker) => [worker.id, worker.auth_user_id || worker.id]));
      const today = new Date().toISOString().slice(0, 10);
      const activeByUser = new Map<string, number>();
      const dueTodayByUser = new Map<string, number>();

      for (const job of jobs || []) {
        const assignedWorkerId = (job as { assigned_to?: string | null }).assigned_to;
        if (!assignedWorkerId) continue;
        const assignedUserId = workerUserById.get(assignedWorkerId) || assignedWorkerId;
        const status = String((job as { status?: string | null }).status || '').toLowerCase();
        if (['completed', 'done', 'complete', 'closed', 'cancelled', 'canceled'].includes(status)) continue;
        activeByUser.set(assignedUserId, (activeByUser.get(assignedUserId) || 0) + 1);
        const dueDate =
          (job as { due_date?: string | null; scheduled_start?: string | null }).due_date?.slice(0, 10) ||
          (job as { scheduled_start?: string | null }).scheduled_start?.slice(0, 10) ||
          null;
        if (dueDate === today) dueTodayByUser.set(assignedUserId, (dueTodayByUser.get(assignedUserId) || 0) + 1);
      }

      const merged = mergeMembersWithLinkedWorkers((members || []) as TeamOption[], workerOptions).map((member) => ({
        ...member,
        active_jobs: activeByUser.get(member.user_id) || 0,
        due_today_jobs: dueTodayByUser.get(member.user_id) || 0
      }));

      setTeamMembers(merged);
      setWorkers(workerOptions);
    }

    void loadAssignmentOptions();
  }, []);

  const selectedAssignee = useMemo(
    () => teamMembers.find((member) => member.user_id === assignedTo) || null,
    [assignedTo, teamMembers]
  );

  const filteredTeamMembers = useMemo(() => {
    const query = teamSearch.trim().toLowerCase();
    if (!query) return teamMembers;
    return teamMembers.filter((member) => {
      const haystack = `${teamLabel(member)} ${teamSubLabel(member)}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [teamMembers, teamSearch]);

  const filteredWorkers = useMemo(() => {
    const query = crewSearch.trim().toLowerCase();
    if (!query) return workers;
    return workers.filter((worker) => worker.name.toLowerCase().includes(query));
  }, [workers, crewSearch]);

  function toggleWorker(workerId: string) {
    setWorkerIds((ids) => (ids.includes(workerId) ? ids.filter((id) => id !== workerId) : [...ids, workerId]));
  }

  async function ensureWorkerForTeamMember(memberUserId: string, organizationId: string, ownerUserId: string) {
    const existing = workers.find((worker) => worker.auth_user_id === memberUserId);
    if (existing) return existing.id;

    const member = teamMembers.find((teamMember) => teamMember.user_id === memberUserId);
    if (!member) return memberUserId;

    const name = teamLabel(member);
    const { data, error } = await supabase
      .from('workers')
      .insert({
        user_id: ownerUserId,
        organization_id: organizationId,
        auth_user_id: memberUserId,
        name,
        role: normalizeRole(member.role)
      })
      .select('id, name, role, auth_user_id')
      .single();

    if (error || !data?.id) {
      throw new Error(error?.message || 'Unable to prepare this team member for assignment.');
    }

    const worker = data as WorkerOption;
    setWorkers((rows) => [...rows, worker]);
    return worker.id;
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

    let assignedWorkerId: string | null = null;
    try {
      assignedWorkerId = assignedTo ? await ensureWorkerForTeamMember(assignedTo, org.organizationId, user.id) : null;
    } catch (error) {
      setLoading(false);
      appFeedback.error(error instanceof Error ? error.message : 'Unable to assign this team member.');
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
        assigned_to: assignedWorkerId,
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
      <form className="form" onSubmit={createJob}>
        <input className="input" placeholder="Job title *" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input className="input" placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className="input" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />

        <section style={{ display: 'grid', gap: 10 }}>
          <label>Assigned to</label>
          <div
            className="input"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minHeight: 54,
              padding: '10px 12px',
              background: 'var(--surface)',
              color: 'inherit'
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: '1px solid var(--line)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: '0 0 32px',
                fontWeight: 700,
                fontSize: 12,
                overflow: 'hidden',
                background: 'var(--bg)'
              }}
            >
              {selectedAssignee ? initials(teamLabel(selectedAssignee)) : '-'}
            </span>
            <span style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>
                {selectedAssignee ? teamLabel(selectedAssignee) : 'Unassigned'}
              </strong>
              <span className="muted" style={{ display: 'block', overflowWrap: 'anywhere' }}>
                {selectedAssignee ? teamSubLabel(selectedAssignee) : 'Choose a team member below'}
              </span>
            </span>
            {assignedTo ? (
              <button type="button" className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setAssignedTo('')}>
                Clear
              </button>
            ) : null}
          </div>

          <input
            className="input"
            placeholder="Search team members..."
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
          />

          <div style={{ display: 'grid', gap: 6, maxHeight: 288, overflow: 'auto' }}>
            {filteredTeamMembers.length === 0 ? (
              <div className="list-row" style={{ minHeight: 58 }}>
                <span>
                  <strong>No team members found.</strong>
                  <span className="muted" style={{ display: 'block' }}>Invite a team member first.</span>
                </span>
              </div>
            ) : null}

            {filteredTeamMembers.map((member) => {
              const selected = assignedTo === member.user_id;
              const url = avatarUrl(member);
              const label = teamLabel(member);
              return (
                <button
                  key={member.user_id}
                  type="button"
                  className="list-row"
                  onClick={() => setAssignedTo(member.user_id)}
                  aria-pressed={selected}
                  style={{
                    cursor: 'pointer',
                    textAlign: 'left',
                    minHeight: 58,
                    borderColor: selected ? 'var(--accent)' : 'var(--line)',
                    background: selected ? 'rgba(31, 59, 47, 0.05)' : 'var(--surface)'
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        border: '1px solid var(--line)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: '0 0 34px',
                        fontWeight: 700,
                        fontSize: 12,
                        overflow: 'hidden',
                        background: 'var(--bg)'
                      }}
                    >
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        initials(label)
                      )}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{label}</strong>
                      <span className="muted" style={{ display: 'block', overflowWrap: 'anywhere' }}>{teamSubLabel(member)}</span>
                    </span>
                  </span>
                  <span className="muted" style={{ whiteSpace: 'nowrap' }}>{selected ? 'Assigned' : assignmentStatus(member)}</span>
                </button>
              );
            })}
          </div>
        </section>

        {workers.length > 0 ? (
          <section style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
              <div>
                <label>Add extra crew</label>
                <p className="muted" style={{ margin: '4px 0 0' }}>{selectedCrewText(workerIds.length)}</p>
              </div>
              <input
                className="input"
                placeholder="Search extra crew..."
                value={crewSearch}
                onChange={(e) => setCrewSearch(e.target.value)}
                style={{ maxWidth: 260 }}
              />
            </div>
            <div style={{ display: 'grid', gap: 6, maxHeight: 240, overflow: 'auto' }}>
              {filteredWorkers.map((worker) => {
                const selected = workerIds.includes(worker.id);
                return (
                  <button
                    key={worker.id}
                    type="button"
                    className="list-row"
                    onClick={() => toggleWorker(worker.id)}
                    aria-pressed={selected}
                    style={{
                      cursor: 'pointer',
                      textAlign: 'left',
                      minHeight: 56,
                      borderColor: selected ? 'var(--accent)' : 'var(--line)',
                      background: selected ? 'rgba(31, 59, 47, 0.05)' : 'var(--surface)'
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span
                        aria-hidden="true"
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          border: '1px solid var(--line)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flex: '0 0 32px',
                          fontWeight: 700,
                          fontSize: 12,
                          background: 'var(--bg)'
                        }}
                      >
                        {initials(worker.name)}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{worker.name}</strong>
                        <span className="muted" style={{ display: 'block' }}>{worker.auth_user_id ? 'Team member' : 'Legacy worker'}</span>
                      </span>
                    </span>
                    <span className="muted">{selected ? 'Added' : 'Add'}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <textarea className="input" placeholder="Notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button className="btn-primary" type="submit" disabled={loading}>
          {loading ? FEEDBACK.loading : 'Save job'}
        </Button>
      </form>
    </div>
  );
}
