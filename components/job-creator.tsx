'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from './ui/button';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { fetchUsageCounts, limitMessage } from '@/lib/everittos-usage';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { FEEDBACK } from '@/lib/feedback-labels';
import { validatePlanAction } from '@/lib/plan-validate';
import { ensureWorkspaceForSave } from '@/lib/workspace-client';

type JobCreatorProps = {
  onJobCreated?: (jobId: string) => void;
};

type TeamMemberOption = {
  userId: string;
  label: string;
  role: string;
};

type VisitDraft = {
  id: string;
  visit_date: string;
  start_time: string;
  end_time: string;
  notes: string;
};

type MemberRow = {
  user_id: string;
  role: string;
  active: boolean;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

function memberLabel(member: MemberRow, profile?: ProfileRow) {
  const name = profile?.full_name?.trim();
  const email = profile?.email?.trim();
  if (name && email) return `${name} (${email})`;
  return name || email || member.user_id;
}

function newVisit(): VisitDraft {
  return {
    id: crypto.randomUUID(),
    visit_date: '',
    start_time: '',
    end_time: '',
    notes: ''
  };
}

function toLocalDateTime(date: string, time: string): string | null {
  if (!date || !time) return null;
  return `${date}T${time}:00`;
}

function validVisits(visits: VisitDraft[]) {
  return visits.filter((visit) => visit.visit_date || visit.start_time || visit.end_time || visit.notes.trim());
}

export function JobCreator({ onJobCreated }: JobCreatorProps) {
  const searchParams = useSearchParams();
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [visits, setVisits] = useState<VisitDraft[]>([newVisit()]);
  const [assignedTo, setAssignedTo] = useState(searchParams.get('assigned_to') || '');
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [loading, setLoading] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const appFeedback = useAppFeedback();
  const { t } = useTranslation();

  useEffect(() => {
    async function loadTeamMembers() {
      setLoadingTeam(true);
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        setLoadingTeam(false);
        return;
      }

      const workspace = await ensureWorkspaceForSave(user.id);
      if (!workspace.ok) {
        setLoadingTeam(false);
        return;
      }

      const { data: memberRows } = await supabase
        .from('organization_members')
        .select('user_id, role, active')
        .eq('organization_id', workspace.workspace.organizationId)
        .eq('active', true)
        .in('role', ['owner', 'admin', 'manager', 'employee', 'contractor'])
        .order('role');

      const members = (memberRows || []) as MemberRow[];
      const memberIds = members.map((member) => member.user_id);
      const { data: profileRows } = memberIds.length
        ? await supabase.from('profiles').select('id, email, full_name').in('id', memberIds)
        : { data: [] as ProfileRow[] };

      const profiles = new Map<string, ProfileRow>();
      for (const profile of (profileRows || []) as ProfileRow[]) {
        profiles.set(profile.id, profile);
      }

      setTeamMembers(
        members.map((member) => ({
          userId: member.user_id,
          role: normalizeRole(member.role),
          label: memberLabel(member, profiles.get(member.user_id))
        }))
      );
      setLoadingTeam(false);
    }

    void loadTeamMembers();
  }, []);

  function updateVisit(id: string, patch: Partial<VisitDraft>) {
    setVisits((rows) => rows.map((visit) => (visit.id === id ? { ...visit, ...patch } : visit)));
  }

  function removeVisit(id: string) {
    setVisits((rows) => (rows.length === 1 ? rows : rows.filter((visit) => visit.id !== id)));
  }

  async function createJob(event?: FormEvent) {
    event?.preventDefault();

    if (loading) return;

    if (!title.trim()) {
      appFeedback.error('Add a job title first.');
      return;
    }

    const scheduledVisits = validVisits(visits);
    for (const visit of scheduledVisits) {
      if (!visit.visit_date || !visit.start_time || !visit.end_time) {
        appFeedback.error('Each visit needs a date, start time, and end time.');
        return;
      }
      if (visit.end_time <= visit.start_time) {
        appFeedback.error('Visit end time must be after start time.');
        return;
      }
    }

    const firstVisit = scheduledVisits[0];
    const lastVisit = scheduledVisits[scheduledVisits.length - 1];
    const scheduledStart = firstVisit ? toLocalDateTime(firstVisit.visit_date, firstVisit.start_time) : null;
    const scheduledEnd = lastVisit ? toLocalDateTime(lastVisit.visit_date, lastVisit.end_time) : null;

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
      appFeedback.error(t('pages.jobs.createPermissionBlocked'));
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
        start_date: firstVisit?.visit_date || null,
        due_date: lastVisit?.visit_date || null,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        visits: scheduledVisits.map((visit) => ({
          visit_date: visit.visit_date,
          start_time: visit.start_time,
          end_time: visit.end_time,
          notes: visit.notes.trim() || null
        })),
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
    setVisits([newVisit()]);
    setAssignedTo('');
    appFeedback.created();
    onJobCreated?.(createdJob.id);
  }

  if (permissionBlocked) {
    return (
      <div className="card">
        <h3>{t('pages.jobs.createTitle')}</h3>
        <p>{t('pages.jobs.createPermissionBlocked')}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>{t('pages.jobs.createTitle')}</h3>
      <p className="muted">Add the job once, including all days and hours needed.</p>
      <form className="form" onSubmit={createJob}>
        <input className="input" placeholder="Job title *" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div className="grid-2">
          <input className="input" placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <input className="input" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />

        <div className="card" style={{ boxShadow: 'none' }}>
          <h4>Days and hours</h4>
          <p className="muted">Add one or more visits before saving the job.</p>
          {visits.map((visit, index) => (
            <div key={visit.id} className="form" style={{ borderTop: index ? '1px solid var(--line)' : 0, paddingTop: index ? 16 : 0 }}>
              <label>Visit {index + 1}</label>
              <input className="input" type="date" value={visit.visit_date} onChange={(e) => updateVisit(visit.id, { visit_date: e.target.value })} />
              <div className="grid-2">
                <div className="form-group">
                  <label>Start time</label>
                  <input className="input" type="time" value={visit.start_time} onChange={(e) => updateVisit(visit.id, { start_time: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>End time</label>
                  <input className="input" type="time" value={visit.end_time} onChange={(e) => updateVisit(visit.id, { end_time: e.target.value })} />
                </div>
              </div>
              <input className="input" placeholder="Visit notes" value={visit.notes} onChange={(e) => updateVisit(visit.id, { notes: e.target.value })} />
              {visits.length > 1 ? (
                <button className="btn" type="button" onClick={() => removeVisit(visit.id)}>
                  Remove visit
                </button>
              ) : null}
            </div>
          ))}
          <button className="btn" type="button" onClick={() => setVisits((rows) => [...rows, newVisit()])}>
            Add another visit
          </button>
        </div>

        <label htmlFor="assigned-to">Assign to</label>
        <select id="assigned-to" className="input" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} disabled={loadingTeam}>
          <option value="">Unassigned</option>
          {teamMembers.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.label} · {member.role}
            </option>
          ))}
        </select>
        {loadingTeam ? <p className="muted">Loading team members...</p> : null}
        {!loadingTeam && teamMembers.length === 0 ? <p className="muted">No active team members found.</p> : null}
        <textarea className="input" placeholder="Notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button className="btn-primary" type="submit" disabled={loading}>
          {loading ? FEEDBACK.loading : 'Save job'}
        </Button>
      </form>
    </div>
  );
}
