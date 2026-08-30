'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { normalizeRole } from '@/lib/roles';
import { normalizeJobStatus } from '@/lib/worker-assignment';
import { supabase } from '@/lib/supabase';

type DirectoryMember = {
  userId: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};

type MemberRow = {
  user_id: string;
  role: string;
  active: boolean;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type WorkerRow = {
  id: string;
  auth_user_id: string | null;
  email: string | null;
};

type JobRow = {
  id: string;
  assigned_to: string | null;
  assigned_email: string | null;
  status: string | null;
  scheduled_start: string | null;
  start_date: string | null;
  completed_at: string | null;
};

type AssignmentRow = {
  job_id: string;
  worker_id: string;
};

type JobSummary = {
  active: number;
  completed: number;
  lastJobAt: string | null;
};

const DEFAULT_VISIBLE_MEMBERS = 8;

function roleLabel(role: string) {
  const normalized = normalizeRole(role);
  if (normalized === 'employee') return 'Staff';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).replaceAll('_', ' ');
}

function emptySummary(): JobSummary {
  return { active: 0, completed: 0, lastJobAt: null };
}

const copy = {
  en: { noJobsYet: 'No jobs yet', showAll: 'Show all people', showLess: 'Show less' },
  es: { noJobsYet: 'Aún no hay trabajos', showAll: 'Mostrar todas las personas', showLess: 'Mostrar menos' },
  vi: { noJobsYet: 'Chưa có công việc', showAll: 'Hiển thị tất cả mọi người', showLess: 'Thu gọn' }
} as const;

function formatLastJob(value: string | null, noJobsYet: string) {
  if (!value) return noJobsYet;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return noJobsYet;
  return `Last job ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function TeamDirectory() {
  const { locale } = useTranslation();
  const c = copy[locale];
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [jobSummaries, setJobSummaries] = useState<Record<string, JobSummary>>({});
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) {
          setError('Sign in to view your team.');
          setLoading(false);
        }
        return;
      }

      const workspace = await ensureOrganizationForUser(user.id);
      if (!workspace) {
        if (!cancelled) {
          setError('Your company is still setting up.');
          setLoading(false);
        }
        return;
      }

      const { data: memberRows, error: memberError } = await supabase
        .from('organization_members')
        .select('user_id, role, active')
        .eq('organization_id', workspace.organizationId)
        .in('role', ['owner', 'admin', 'manager', 'employee', 'contractor'])
        .order('role');

      if (memberError) {
        if (!cancelled) {
          setError('Team members could not be loaded.');
          setLoading(false);
        }
        return;
      }

      const rows = (memberRows || []) as MemberRow[];
      const ids = rows.map((row) => row.user_id);
      const [{ data: profileRows }, { data: workerRows }, { data: jobRows }, { data: assignmentRows }] = await Promise.all([
        ids.length
          ? supabase.from('profiles').select('id, full_name, email').in('id', ids)
          : Promise.resolve({ data: [] as ProfileRow[] }),
        supabase
          .from('workers')
          .select('id, auth_user_id, email')
          .eq('organization_id', workspace.organizationId),
        supabase
          .from('jobs')
          .select('id, assigned_to, assigned_email, status, scheduled_start, start_date, completed_at')
          .eq('organization_id', workspace.organizationId),
        supabase
          .from('job_assignments')
          .select('job_id, worker_id')
          .eq('organization_id', workspace.organizationId)
      ]);

      const profiles = new Map<string, ProfileRow>();
      for (const profile of (profileRows || []) as ProfileRow[]) profiles.set(profile.id, profile);

      const next = rows
        .map((row) => {
          const profile = profiles.get(row.user_id);
          const email = profile?.email?.trim() || '';
          const name = profile?.full_name?.trim() || email || 'Team member';
          return {
            userId: row.user_id,
            name,
            email,
            role: normalizeRole(row.role),
            active: row.active
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      const workers = (workerRows || []) as WorkerRow[];
      const jobs = (jobRows || []) as JobRow[];
      const assignments = (assignmentRows || []) as AssignmentRow[];
      const userIdByWorkerId = new Map<string, string>();
      const userIdByEmail = new Map<string, string>();
      const jobById = new Map(jobs.map((job) => [job.id, job]));
      const jobIdsByUserId = new Map<string, Set<string>>();

      for (const member of next) {
        if (member.email) userIdByEmail.set(member.email.toLowerCase(), member.userId);
        jobIdsByUserId.set(member.userId, new Set());
      }

      for (const worker of workers) {
        if (worker.auth_user_id && ids.includes(worker.auth_user_id)) {
          userIdByWorkerId.set(worker.id, worker.auth_user_id);
        } else if (worker.email) {
          const userId = userIdByEmail.get(worker.email.trim().toLowerCase());
          if (userId) userIdByWorkerId.set(worker.id, userId);
        }
      }

      const addJob = (userId: string | undefined, jobId: string) => {
        if (!userId || !jobIdsByUserId.has(userId)) return;
        jobIdsByUserId.get(userId)?.add(jobId);
      };

      for (const job of jobs) {
        const directAssignment = String(job.assigned_to || '');
        const directUserId = userIdByWorkerId.get(directAssignment) || (ids.includes(directAssignment) ? directAssignment : undefined);
        addJob(directUserId, job.id);

        if (job.assigned_email) {
          addJob(userIdByEmail.get(job.assigned_email.trim().toLowerCase()), job.id);
        }
      }

      for (const assignment of assignments) {
        addJob(userIdByWorkerId.get(assignment.worker_id), assignment.job_id);
      }

      const summaries: Record<string, JobSummary> = {};
      const now = Date.now();
      for (const id of ids) {
        const summary = emptySummary();
        for (const jobId of jobIdsByUserId.get(id) || []) {
          const job = jobById.get(jobId);
          if (!job) continue;
          const status = normalizeJobStatus(job.status);
          if (status === 'completed') summary.completed += 1;
          else if (status === 'active' || status === 'unknown') summary.active += 1;

          const candidates = [job.completed_at, job.scheduled_start, job.start_date]
            .filter((value): value is string => Boolean(value))
            .map((value) => ({ value, time: new Date(value).getTime() }))
            .filter(({ time }) => Number.isFinite(time) && time <= now)
            .sort((a, b) => b.time - a.time);
          const latestPastJob = candidates[0]?.value || null;
          if (latestPastJob && (!summary.lastJobAt || new Date(latestPastJob).getTime() > new Date(summary.lastJobAt).getTime())) {
            summary.lastJobAt = latestPastJob;
          }
        }
        summaries[id] = summary;
      }

      if (!cancelled) {
        setMembers(next);
        setJobSummaries(summaries);
        setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setShowAllMembers(false);
  }, [query, roleFilter, statusFilter]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return members.filter((member) => {
      if (roleFilter !== 'all' && member.role !== roleFilter) return false;
      if (statusFilter === 'active' && !member.active) return false;
      if (statusFilter === 'inactive' && member.active) return false;
      if (!text) return true;
      return [member.name, member.email, roleLabel(member.role)].some((value) => value.toLowerCase().includes(text));
    });
  }, [members, query, roleFilter, statusFilter]);

  const visibleMembers = showAllMembers ? filtered : filtered.slice(0, DEFAULT_VISIBLE_MEMBERS);
  const activeCount = members.filter((member) => member.active).length;

  return (
    <section className="card team-directory-card">
      <div className="team-directory-header">
        <div>
          <h2>Team members</h2>
          <p className="muted">{activeCount} active · Find someone and assign work.</p>
        </div>
        <div className="inline-actions team-directory-actions">
          <Link className="btn" href="/people#invite-by-email">Add team member</Link>
          <Link className="btn btn-primary" href="/jobs/new">Create job</Link>
        </div>
      </div>

      <div className="grid-2 team-directory-filters">
        <label>
          Search team
          <input className="input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email, or role" />
        </label>
        <label>
          Role
          <select className="input" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="all">All roles</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="employee">Staff</option>
            <option value="contractor">Contractor</option>
          </select>
        </label>
      </div>

      <div className="segmented-control" role="group" aria-label="Team member status">
        <button type="button" className={`btn${statusFilter === 'active' ? ' btn-primary' : ''}`} onClick={() => setStatusFilter('active')}>Active</button>
        <button type="button" className={`btn${statusFilter === 'inactive' ? ' btn-primary' : ''}`} onClick={() => setStatusFilter('inactive')}>Inactive</button>
        <button type="button" className={`btn${statusFilter === 'all' ? ' btn-primary' : ''}`} onClick={() => setStatusFilter('all')}>All</button>
      </div>

      {loading ? <p className="loading-state team-directory-state">Loading team...</p> : null}
      {error ? <p className="auth-message auth-message-error team-directory-state">{error}</p> : null}
      {!loading && !error && filtered.length === 0 ? <p className="muted team-directory-state">No matching team members.</p> : null}

      <div className="customer-list team-member-list">
        {visibleMembers.map((member) => {
          const summary = jobSummaries[member.userId] || emptySummary();
          return (
            <article key={member.userId} className="list-row customer-row team-member-card open-in-new-tab-card">
              <Link href={`/jobs?assigned_to=${encodeURIComponent(member.userId)}`} target="_blank" rel="noopener noreferrer" className="record-card-overlay-link" aria-label={`Open jobs for ${member.name} in a new tab`}><span className="record-card-overlay-label">Open jobs for {member.name} in a new tab</span></Link>
              <div className="team-member-copy">
                <strong>{member.name}</strong>
                <p className="muted team-member-meta">{roleLabel(member.role)} · {member.active ? 'Active' : 'Inactive'}</p>
                {member.email ? <p className="muted team-member-email">{member.email}</p> : null}
                <p className="muted team-member-summary">
                  {summary.active} active · {summary.completed} completed · {formatLastJob(summary.lastJobAt, c.noJobsYet)}
                </p>
              </div>
              {member.active ? (
                <div className="inline-actions team-member-actions">
                  <Link className="btn btn-sm" href={`/jobs?assigned_to=${encodeURIComponent(member.userId)}`} target="_blank" rel="noopener noreferrer">View jobs</Link>
                  <Link className="btn btn-sm btn-primary" href={`/jobs/new?assigned_to=${encodeURIComponent(member.userId)}`}>Assign to job</Link>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {!loading && !error && filtered.length > DEFAULT_VISIBLE_MEMBERS ? (
        <div className="team-directory-list-toggle" style={{ marginTop: 16 }}>
          <button type="button" className="btn" onClick={() => setShowAllMembers((value) => !value)} aria-expanded={showAllMembers}>
            {showAllMembers ? c.showLess : `${c.showAll} (${filtered.length})`}
          </button>
        </div>
      ) : null}
    </section>
  );
}
