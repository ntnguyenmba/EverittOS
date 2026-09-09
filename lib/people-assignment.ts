import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeRole } from '@/lib/roles';

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
  worker_type?: string | null;
};

const ASSIGNABLE_MEMBER_ROLES = ['owner', 'admin', 'manager', 'employee', 'contractor', 'staff', 'crew_lead'];

function memberName(member: MemberRow): string {
  return member.profiles?.full_name?.trim() || member.profiles?.email?.trim() || 'Pending profile';
}

function isClientLikeWorker(worker: WorkerRow) {
  const type = String(worker.worker_type || '').toLowerCase();
  return type === 'client' || type === 'customer' || type === 'viewer';
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
      .in('role', ASSIGNABLE_MEMBER_ROLES)
      .order('created_at', { ascending: true }),
    supabase
      .from('workers')
      .select('id, name, auth_user_id, worker_type')
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
  const workers = ((workersRes.data || []) as WorkerRow[]).filter((worker) => !isClientLikeWorker(worker));
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
      role: 'contractor'
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
    .select('id, active')
    .eq('organization_id', organizationId)
    .eq('auth_user_id', userId)
    .order('created_at', { ascending: true })
    .limit(20);

  const rows = data || [];
  const active = rows.find((row) => row.active !== false);
  return active?.id ?? rows[0]?.id ?? null;
}

async function workerIdForEmail(
  supabase: SupabaseClient,
  organizationId: string,
  email: string | null | undefined
): Promise<string | null> {
  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  if (!normalized) return null;

  const { data } = await supabase
    .from('workers')
    .select('id, email, auth_user_id, active')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })
    .limit(50);

  const match = (data || []).find((row) => {
    const rowEmail = String(row.email || '')
      .trim()
      .toLowerCase();
    return rowEmail === normalized && row.active !== false;
  });
  return match?.id ?? null;
}

export async function ensureWorkerForPerson(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  displayName: string,
  ownerUserId?: string | null,
  email?: string | null
): Promise<string> {
  const existing = await workerIdForPerson(supabase, organizationId, userId);
  if (existing) return existing;

  const byEmail = await workerIdForEmail(supabase, organizationId, email);
  if (byEmail) {
    const { error: linkError } = await supabase
      .from('workers')
      .update({
        auth_user_id: userId,
        active: true,
        email: email?.trim() || undefined,
        name: displayName.trim() || undefined
      })
      .eq('id', byEmail)
      .eq('organization_id', organizationId);

    if (linkError) {
      throw new Error(linkError.message || 'Unable to link existing crew record for this person.');
    }
    return byEmail;
  }

  const { data, error } = await supabase
    .from('workers')
    .insert({
      organization_id: organizationId,
      user_id: ownerUserId || userId,
      auth_user_id: userId,
      email: email?.trim() || null,
      name: displayName.trim() || 'Team member',
      active: true
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    const raced = await workerIdForPerson(supabase, organizationId, userId);
    if (raced) return raced;
    const racedEmail = await workerIdForEmail(supabase, organizationId, email);
    if (racedEmail) return racedEmail;
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

  return ensureWorkerForPerson(supabase, organizationId, userId, displayName, ownerUserId, null);
}
