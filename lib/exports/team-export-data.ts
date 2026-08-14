/**
 * Server-side team roster export.
 * No passwords, tokens, W-9, or tax IDs.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { displayPersonName, formatExportDateTime } from '@/lib/exports/format';
import { canViewTeam, normalizeRole } from '@/lib/roles';
import { normalizeJobStatus } from '@/lib/worker-assignment';
import type { CurrentWorkspace } from '@/lib/workspace-server';

function jobIsActive(status: string | null | undefined): boolean {
  const normalized = normalizeJobStatus(status);
  return normalized === 'active' || normalized === 'unknown';
}

export type TeamExportRow = Record<string, string | number>;

export type TeamExportResult = {
  rows: TeamExportRow[];
  summary: { memberCount: number; pendingInvitationCount: number };
  appliedFilters: string[];
  companyName: string;
};

export async function loadTeamExportData(input: {
  supabase: SupabaseClient;
  workspace: CurrentWorkspace;
  /** Prefer admin client for invitations/members when available. */
  admin?: SupabaseClient | null;
}): Promise<{ ok: true; data: TeamExportResult } | { ok: false; error: string; status: number }> {
  const role = normalizeRole(input.workspace.role);
  if (!canViewTeam(role)) {
    return { ok: false, error: 'You do not have permission to export the team.', status: 403 };
  }

  const organizationId = input.workspace.organizationId;
  if (!organizationId) {
    return { ok: false, error: 'Workspace not found.', status: 404 };
  }

  const db = input.admin || input.supabase;

  const [{ data: memberRows, error: memberError }, { data: invitationRows }] = await Promise.all([
    db
      .from('organization_members')
      .select('user_id, role, active, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true }),
    db
      .from('organization_invitations')
      .select('email, role, status, created_at')
      .eq('organization_id', organizationId)
  ]);

  if (memberError) {
    return { ok: false, error: 'Unable to load team members for export.', status: 500 };
  }

  const members = memberRows || [];
  const userIds = members.map((m) => m.user_id as string).filter(Boolean);

  const { data: profileRows } = userIds.length
    ? await db
        .from('profiles')
        .select('id, email, full_name, updated_at, last_seen_at')
        .in('id', userIds)
    : { data: [] as Array<{
        id: string;
        email: string | null;
        full_name: string | null;
        updated_at: string | null;
        last_seen_at: string | null;
      }> };

  const profiles = new Map<
    string,
    {
      id: string;
      email: string | null;
      full_name: string | null;
      updated_at: string | null;
      last_seen_at: string | null;
    }
  >();
  for (const profile of profileRows || []) {
    profiles.set(profile.id, profile as (typeof profiles extends Map<string, infer V> ? V : never));
  }

  const { data: workers } = await db
    .from('workers')
    .select('id, auth_user_id, email, name, created_at, active, contractor_classification')
    .eq('organization_id', organizationId);

  const workerIdsByUser = new Map<string, string[]>();
  const userIdByWorker = new Map<string, string>();
  for (const worker of workers || []) {
    const workerId = String(worker.id || '');
    const authUserId = worker.auth_user_id ? String(worker.auth_user_id) : '';
    if (!workerId) continue;
    if (authUserId) {
      const list = workerIdsByUser.get(authUserId) || [];
      list.push(workerId);
      workerIdsByUser.set(authUserId, list);
      userIdByWorker.set(workerId, authUserId);
    }
  }

  const { data: jobs } = await db
    .from('jobs')
    .select('id, status, assigned_to, assigned_email')
    .eq('organization_id', organizationId)
    .limit(10000);

  const { data: assignments } = await db
    .from('job_assignments')
    .select('job_id, worker_id')
    .eq('organization_id', organizationId);

  const jobById = new Map((jobs || []).map((j) => [j.id as string, j]));
  const assignedJobIdsByUser = new Map<string, Set<string>>();

  const ensureSet = (userId: string) => {
    let set = assignedJobIdsByUser.get(userId);
    if (!set) {
      set = new Set();
      assignedJobIdsByUser.set(userId, set);
    }
    return set;
  };

  for (const job of jobs || []) {
    const assigned = String(job.assigned_to || '');
    if (!assigned) continue;
    const userId = userIdByWorker.get(assigned) || (userIds.includes(assigned) ? assigned : '');
    if (userId) ensureSet(userId).add(job.id as string);
  }

  for (const row of assignments || []) {
    const workerId = String(row.worker_id || '');
    const jobId = String(row.job_id || '');
    if (!workerId || !jobId) continue;
    const userId = userIdByWorker.get(workerId);
    if (userId) ensureSet(userId).add(jobId);
  }

  const pendingByEmail = new Map<string, string>();
  let pendingInvitationCount = 0;
  for (const invite of invitationRows || []) {
    const email = String(invite.email || '')
      .trim()
      .toLowerCase();
    const status = String(invite.status || '').toLowerCase();
    if (!email) continue;
    if (status === 'pending') {
      pendingInvitationCount += 1;
      pendingByEmail.set(email, 'pending');
    } else if (!pendingByEmail.has(email)) {
      pendingByEmail.set(email, status || 'none');
    }
  }

  const rows: TeamExportRow[] = members.map((member) => {
    const userId = member.user_id as string;
    const profile = profiles.get(userId);
    const email = String(profile?.email || '').trim();
    const jobIds = assignedJobIdsByUser.get(userId) || new Set<string>();
    let assignedJobCount = 0;
    let completedJobCount = 0;
    let currentActiveJobCount = 0;

    for (const jobId of Array.from(jobIds)) {
      const job = jobById.get(jobId);
      if (!job) continue;
      assignedJobCount += 1;
      const normalized = normalizeJobStatus(job.status as string);
      if (normalized === 'completed') {
        completedJobCount += 1;
      } else if (jobIsActive(job.status as string)) {
        currentActiveJobCount += 1;
      }
    }

    const invitationStatus =
      pendingByEmail.get(email.toLowerCase()) || (member.active ? 'accepted' : 'inactive');

    return {
      memberName: displayPersonName(profile?.full_name, email),
      email,
      role: String(member.role || ''),
      accountStatus: member.active ? 'active' : 'inactive',
      invitationStatus,
      joinedDate: formatExportDateTime(member.created_at as string | null),
      lastActiveDate: formatExportDateTime(
        (profile?.last_seen_at as string | null) || (profile?.updated_at as string | null)
      ),
      assignedJobCount,
      completedJobCount,
      currentActiveJobCount
    };
  });

  // Pending invitations without a member row yet
  for (const invite of invitationRows || []) {
    const status = String(invite.status || '').toLowerCase();
    if (status !== 'pending') continue;
    const email = String(invite.email || '').trim();
    if (!email) continue;
    const already = rows.some((row) => String(row.email).toLowerCase() === email.toLowerCase());
    if (already) continue;
    rows.push({
      memberName: displayPersonName(null, email),
      email,
      role: String(invite.role || ''),
      accountStatus: 'invited',
      invitationStatus: 'pending',
      joinedDate: '',
      lastActiveDate: '',
      assignedJobCount: 0,
      completedJobCount: 0,
      currentActiveJobCount: 0
    });
  }

  const memberUserIds = new Set(userIds);
  const emailsInExport = new Set(rows.map((row) => String(row.email).toLowerCase()).filter(Boolean));
  for (const worker of workers || []) {
    const authUserId = worker.auth_user_id ? String(worker.auth_user_id) : '';
    if (authUserId && memberUserIds.has(authUserId)) continue;
    const email = String(worker.email || '').trim();
    if (email && emailsInExport.has(email.toLowerCase())) continue;
    const workerId = String(worker.id || '');
    let assignedJobCount = 0;
    let completedJobCount = 0;
    let currentActiveJobCount = 0;
    for (const job of jobs || []) {
      if (String(job.assigned_to || '') !== workerId) continue;
      assignedJobCount += 1;
      const normalized = normalizeJobStatus(job.status as string);
      if (normalized === 'completed') completedJobCount += 1;
      else if (jobIsActive(job.status as string)) currentActiveJobCount += 1;
    }
    for (const row of assignments || []) {
      if (String(row.worker_id || '') !== workerId) continue;
      const job = jobById.get(String(row.job_id || ''));
      if (!job) continue;
      assignedJobCount += 1;
      const normalized = normalizeJobStatus(job.status as string);
      if (normalized === 'completed') completedJobCount += 1;
      else if (jobIsActive(job.status as string)) currentActiveJobCount += 1;
    }
    rows.push({
      memberName: displayPersonName(worker.name as string | null, email),
      email,
      role: String(worker.contractor_classification || 'contractor'),
      accountStatus: worker.active === false ? 'inactive' : 'active',
      invitationStatus: 'worker',
      joinedDate: formatExportDateTime(worker.created_at as string | null),
      lastActiveDate: '',
      assignedJobCount,
      completedJobCount,
      currentActiveJobCount
    });
    if (email) emailsInExport.add(email.toLowerCase());
  }

  return {
    ok: true,
    data: {
      rows,
      summary: {
        memberCount: members.length,
        pendingInvitationCount
      },
      appliedFilters: ['All team members'],
      companyName: input.workspace.organizationName || 'EverittOS'
    }
  };
}
