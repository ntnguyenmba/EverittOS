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
  email?: string | null;
  active?: boolean | null;
};

const ASSIGNABLE_MEMBER_ROLES = ['owner', 'admin', 'manager', 'employee', 'contractor', 'staff', 'crew_lead'];
const CLIENT_ROLES = new Set(['client', 'viewer', 'customer']);

function memberName(member: MemberRow): string {
  return member.profiles?.full_name?.trim() || member.profiles?.email?.trim() || 'Pending profile';
}

function isClientLikeRole(role: string | null | undefined) {
  return CLIENT_ROLES.has(normalizeRole(role));
}

function isClientLikeWorker(worker: WorkerRow) {
  const type = String(worker.worker_type || '').toLowerCase();
  return type === 'client' || type === 'customer' || type === 'viewer';
}

export async function getPeopleForAssignment(
  supabase: SupabaseClient,
  organizationId: string
): Promise<PersonAssignmentOption[]> {
  const [membersRes, workersRes, customersRes] = await Promise.all([
    supabase
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', organizationId)
      .eq('active', true),
    supabase
      .from('workers')
      .select('id, name, auth_user_id, worker_type, email, active')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true }),
    supabase.from('customers').select('email').eq('organization_id', organizationId)
  ]);

  const allMembers = membersRes.data || [];
  const clientUserIds = new Set(
    allMembers.filter((row) => isClientLikeRole(row.role)).map((row) => String(row.user_id))
  );
  const staffMembers = allMembers.filter((row) => ASSIGNABLE_MEMBER_ROLES.includes(String(row.role || '').toLowerCase()));
  const customerEmails = new Set(
    (customersRes.data || [])
      .map((row) => String(row.email || '').trim().toLowerCase())
      .filter(Boolean)
  );

  const staffIds = staffMembers.map((row) => row.user_id);
  const profileMap = new Map<string, { email: string | null; full_name: string | null }>();
  if (staffIds.length) {
    const profilesRes = await supabase.from('profiles').select('id, email, full_name').in('id', staffIds);
    for (const profile of profilesRes.data || []) {
      profileMap.set(profile.id, {
        email: profile.email ?? null,
        full_name: profile.full_name ?? null
      });
    }
  }

  const workers = ((workersRes.data || []) as WorkerRow[]).filter((worker) => {
    if (worker.active === false) return false;
    if (isClientLikeWorker(worker)) return false;
    const authId = String(worker.auth_user_id || '');
    if (authId && clientUserIds.has(authId)) return false;
    const email = String(worker.email || '').trim().toLowerCase();
    if (email && customerEmails.has(email)) return false;
    return true;
  });

  const options: PersonAssignmentOption[] = [];
  const usedWorkerIds = new Set<string>();
  const usedUserIds = new Set<string>();

  for (const worker of workers) {
    usedWorkerIds.add(worker.id);
    if (worker.auth_user_id) usedUserIds.add(worker.auth_user_id);
    options.push({
      userId: worker.auth_user_id || worker.id,
      workerId: worker.id,
      name: worker.name,
      role: worker.worker_type === 'contractor' ? 'contractor' : 'employee'
    });
  }

  for (const member of staffMembers) {
    if (clientUserIds.has(member.user_id)) continue;
    if (usedUserIds.has(member.user_id)) continue;
    const profile = profileMap.get(member.user_id);
    const email = String(profile?.email || '').trim().toLowerCase();
    if (email && customerEmails.has(email)) continue;
    usedUserIds.add(member.user_id);
    options.push({
      userId: member.user_id,
      workerId: null,
      name: memberName({ user_id: member.user_id, role: member.role, profiles: profile || null }),
      role: normalizeRole(member.role)
    });
  }

  options.sort((a, b) => a.name.localeCompare(b.name));
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
