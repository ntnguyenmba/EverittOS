import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeRole } from '@/lib/roles';

/**
 * People-first assignment helpers.
 *
 * - organization_members are the primary source for assignees.
 * - workers is compatibility storage for schedule APIs and job_assignments.
 * - jobs.assigned_to may store auth user IDs (preferred) or legacy worker IDs.
 */

export type PersonAssignmentOption = {
  userId: string;
  workerId: string | null;
  name: string;
  role: string;
};

type MemberRow = {
  user_id: string;
  role: string;
  profiles?: { email?: string | null; full_name?: string | null } | null;
};

type WorkerRow = {
  id: string;
  name: string;
  auth_user_id?: string | null;
};

function memberName(member: MemberRow): string {
  return member.profiles?.full_name?.trim() || member.profiles?.email?.trim() || 'Pending profile';
}

export async function getPeopleForAssignment(
  supabase: SupabaseClient,
  organizationId: string
): Promise<PersonAssignmentOption[]> {
  const [membersRes, workersRes] = await Promise.all([
    supabase
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', organizationId)
      .eq('active', true)
      .in('role', ['manager', 'employee', 'contractor', 'staff', 'crew_lead', 'admin'])
      .order('created_at', { ascending: true }),
    supabase
      .from('workers')
      .select('id, name, auth_user_id')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true })
  ]);

  const rawMembers = membersRes.data || [];
  const memberIds = rawMembers.map((row) => row.user_id);
  const profileMap = new Map<string, { email: string | null; full_name: string | null }>();
  if (memberIds.length) {
    const profilesRes = await supabase.from('profiles').select('id, email, full_name').in('id', memberIds);
    for (const profile of profilesRes.data || []) {
      profileMap.set(profile.id, {
        email: profile.email ?? null,
        full_name: profile.full_name ?? null
      });
    }
  }

  const members: MemberRow[] = rawMembers.map((row) => ({
    user_id: row.user_id,
    role: row.role,
    profiles: profileMap.get(row.user_id) || null
  }));
  const workers = (workersRes.data || []) as WorkerRow[];
  const workerByAuthUser = new Map(
    workers
      .filter((worker) => worker.auth_user_id)
      .map((worker) => [worker.auth_user_id as string, worker])
  );

  const options: PersonAssignmentOption[] = members.map((member) => ({
    userId: member.user_id,
    workerId: workerByAuthUser.get(member.user_id)?.id ?? null,
    name: memberName(member),
    role: normalizeRole(member.role)
  }));

  const representedWorkerIds = new Set(options.map((option) => option.workerId).filter(Boolean) as string[]);
  for (const worker of workers) {
    if (worker.auth_user_id) continue;
    if (representedWorkerIds.has(worker.id)) continue;
    options.push({
      userId: worker.id,
      workerId: worker.id,
      name: worker.name,
      role: 'crew'
    });
  }

  return options;
}

export async function workerIdForPerson(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('workers')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('auth_user_id', userId)
    .maybeSingle();

  return data?.id ?? null;
}

export async function ensureWorkerForPerson(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  displayName: string,
  ownerUserId?: string | null
): Promise<string> {
  const existing = await workerIdForPerson(supabase, organizationId, userId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('workers')
    .insert({
      organization_id: organizationId,
      user_id: ownerUserId || userId,
      auth_user_id: userId,
      name: displayName.trim() || 'Team member'
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || 'Unable to link crew record for this person.');
  }

  return data.id;
}

export function resolveAssignedUserId(
  assignedTo: string | null | undefined,
  people: PersonAssignmentOption[]
): string {
  if (!assignedTo) return '';

  const direct = people.find((person) => person.userId === assignedTo);
  if (direct) return direct.userId;

  const viaWorker = people.find((person) => person.workerId === assignedTo);
  if (viaWorker) return viaWorker.userId;

  return assignedTo;
}

export async function assignedToForScheduleApi(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string | null,
  displayName: string,
  ownerUserId?: string | null
): Promise<string | null> {
  if (!userId) return null;

  const person = (await getPeopleForAssignment(supabase, organizationId)).find((item) => item.userId === userId);
  if (person?.workerId) return person.workerId;
  if (person && person.userId === person.workerId) return person.workerId;

  return ensureWorkerForPerson(supabase, organizationId, userId, displayName, ownerUserId);
}
