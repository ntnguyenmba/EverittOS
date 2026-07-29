import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePlan } from '@/lib/everittos-plans';
import { inviteAcceptLandingPath } from '@/lib/portal-access';
import { isClientRole, normalizeRole, type UserRole } from '@/lib/roles';

export type ClientPortalRepairResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  userId: string;
  email?: string;
  role?: UserRole | string;
  organizationId?: string | null;
  jobIds?: string[];
  redirectTo?: string;
  invitesRepaired?: number;
  membershipUpserts?: number;
  accessUpserts?: number;
  profileUpdated?: boolean;
  error?: string;
  source?: 'rpc' | 'admin';
};

const PROTECTED_ROLES = new Set<UserRole>([
  'admin',
  'manager',
  'employee',
  'contractor',
  'viewer'
]);

function normalizeEmail(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

/** Pure helper: whether a role may be converted/repaired into a client portal guest. */
export function canRepairAsClientRole(roleInput: string | null | undefined): boolean {
  const role = normalizeRole(roleInput || 'owner');
  if (PROTECTED_ROLES.has(role)) return false;
  return role === 'client' || role === 'owner';
}

export async function isBusinessOwnerWorkspace(
  admin: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data: ownedOrgs } = await admin
    .from('organizations')
    .select('id, plan')
    .eq('owner_user_id', userId);

  for (const org of ownedOrgs || []) {
    if (normalizePlan(org.plan) !== 'free') return true;

    const { count: otherMembers } = await admin
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .eq('active', true)
      .neq('user_id', userId);
    if ((otherMembers || 0) > 0) return true;

    const { count: jobs } = await admin
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id);
    if ((jobs || 0) > 0) return true;
  }

  const { data: staffMemberships } = await admin
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .eq('active', true)
    .in('role', ['owner', 'admin', 'manager', 'employee', 'contractor', 'crew_lead', 'staff', 'viewer']);

  for (const membership of staffMemberships || []) {
    const role = normalizeRole(membership.role);
    if (role === 'client') continue;
    const { count: otherMembers } = await admin
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', membership.organization_id)
      .eq('active', true)
      .neq('user_id', userId);
    if ((otherMembers || 0) > 0) return true;
  }

  return false;
}

async function repairViaAdmin(
  admin: SupabaseClient,
  userId: string,
  emailHint?: string | null
): Promise<ClientPortalRepairResult> {
  const { data: profile } = await admin
    .from('profiles')
    .select('email, role, organization_id')
    .eq('id', userId)
    .maybeSingle();

  const email = normalizeEmail(profile?.email || emailHint);
  const role = normalizeRole(profile?.role || 'owner');

  if (!email) {
    return { ok: false, userId, error: 'email_missing', source: 'admin' };
  }

  if (!canRepairAsClientRole(role)) {
    return {
      ok: true,
      skipped: true,
      reason: 'protected_role',
      userId,
      email,
      role,
      source: 'admin'
    };
  }

  const { data: existingAccess } = await admin
    .from('job_client_access')
    .select('job_id, organization_id')
    .eq('client_user_id', userId);

  const hasAccess = (existingAccess || []).length > 0;
  const businessOwner = role === 'owner' ? await isBusinessOwnerWorkspace(admin, userId) : false;

  const { data: inviteRows } = await admin
    .from('organization_invitations')
    .select('id, organization_id, job_id, status, created_at, email')
    .eq('role', 'client')
    .in('status', ['pending', 'accepted', 'expired'])
    .order('created_at', { ascending: false });

  const invites = (inviteRows || []).filter((invite) => normalizeEmail(invite.email) === email);

  const eligible =
    isClientRole(role) ||
    hasAccess ||
    (role === 'owner' && !businessOwner && invites.length > 0);

  if (!eligible) {
    return {
      ok: true,
      skipped: true,
      reason: 'not_eligible',
      userId,
      email,
      role,
      source: 'admin'
    };
  }

  let invitesRepaired = 0;
  let membershipUpserts = 0;
  let accessUpserts = 0;
  let profileUpdated = false;
  let targetOrg: string | null = null;
  const jobIds = new Set<string>((existingAccess || []).map((row) => String(row.job_id)).filter(Boolean));

  for (const invite of invites) {
    const { data: org } = await admin
      .from('organizations')
      .select('owner_user_id')
      .eq('id', invite.organization_id)
      .maybeSingle();

    if (org?.owner_user_id === userId) {
      continue;
    }

    invitesRepaired += 1;
    if (!targetOrg) targetOrg = invite.organization_id;

    const { error: memberError } = await admin.from('organization_members').upsert(
      {
        organization_id: invite.organization_id,
        user_id: userId,
        role: 'client',
        active: true
      },
      { onConflict: 'organization_id,user_id' }
    );
    if (!memberError) membershipUpserts += 1;

    if (invite.status === 'pending' || invite.status === 'expired') {
      await admin
        .from('organization_invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invite.id)
        .in('status', ['pending', 'expired']);
    }

    if (invite.job_id) {
      const { data: job } = await admin
        .from('jobs')
        .select('organization_id')
        .eq('id', invite.job_id)
        .maybeSingle();

      const { error: accessError } = await admin.from('job_client_access').upsert(
        {
          job_id: invite.job_id,
          client_user_id: userId,
          owner_user_id: org?.owner_user_id,
          organization_id: invite.organization_id || job?.organization_id || null,
          granted_at: new Date().toISOString()
        },
        { onConflict: 'job_id,client_user_id' }
      );
      if (!accessError) {
        accessUpserts += 1;
        jobIds.add(String(invite.job_id));
      }
    }
  }

  for (const row of existingAccess || []) {
    if (!row.organization_id && row.job_id) {
      const { data: job } = await admin.from('jobs').select('organization_id').eq('id', row.job_id).maybeSingle();
      if (job?.organization_id) {
        await admin
          .from('job_client_access')
          .update({ organization_id: job.organization_id })
          .eq('client_user_id', userId)
          .eq('job_id', row.job_id);
        if (!targetOrg) targetOrg = job.organization_id;
      }
    } else if (row.organization_id && !targetOrg) {
      targetOrg = row.organization_id;
    }

    if (row.organization_id) {
      await admin.from('organization_members').upsert(
        {
          organization_id: row.organization_id,
          user_id: userId,
          role: 'client',
          active: true
        },
        { onConflict: 'organization_id,user_id' }
      );
    }
  }

  if (targetOrg) {
    const { error: profileError } = await admin
      .from('profiles')
      .update({ role: 'client', organization_id: targetOrg })
      .eq('id', userId);
    if (!profileError) {
      profileUpdated = true;
    }
  } else if (isClientRole(role) || hasAccess) {
    const { error: profileError } = await admin.from('profiles').update({ role: 'client' }).eq('id', userId);
    if (!profileError) profileUpdated = true;
  }

  const finalRole: UserRole = targetOrg || hasAccess || profileUpdated ? 'client' : role;
  const sharedJobIds = Array.from(jobIds);

  return {
    ok: true,
    userId,
    email,
    role: finalRole,
    organizationId: targetOrg,
    jobIds: sharedJobIds,
    redirectTo: inviteAcceptLandingPath(finalRole, {
      jobId: sharedJobIds.length === 1 ? sharedJobIds[0] : null,
      sharedJobIds
    }),
    invitesRepaired,
    membershipUpserts,
    accessUpserts,
    profileUpdated,
    source: 'admin'
  };
}

/**
 * Repairs incomplete client-portal relationships for an existing account.
 * Prefers the DB RPC when available; falls back to an admin-side mirror.
 * Safe for owners/managers/contractors: those roles are skipped.
 */
export async function repairClientPortalAccessForUser(
  admin: SupabaseClient | null | undefined,
  userId: string,
  emailHint?: string | null
): Promise<ClientPortalRepairResult> {
  if (!admin || !userId) {
    return { ok: false, userId: userId || '', error: 'admin_unavailable' };
  }

  try {
    const { data, error } = await admin.rpc('repair_client_portal_access_for_user', {
      p_user_id: userId
    });
    if (!error && data && typeof data === 'object') {
      const result = data as Record<string, unknown>;
      const role = normalizeRole(String(result.role || 'client'));
      const organizationId = (result.organizationId as string | null | undefined) ?? null;
      const rpcOk = Boolean(result.ok);
      const rpcSkipped = Boolean(result.skipped);

      // A deployed but older RPC can incorrectly skip existing client accounts.
      // Let the admin mirror verify job access and invitations before accepting a skip.
      if (rpcOk && !rpcSkipped) {
        const { data: access } = await admin.from('job_client_access').select('job_id').eq('client_user_id', userId);
        const jobIds = (access || []).map((row) => String(row.job_id)).filter(Boolean);

        return {
          ok: true,
          skipped: false,
          reason: result.reason ? String(result.reason) : undefined,
          userId,
          email: result.email ? String(result.email) : normalizeEmail(emailHint),
          role,
          organizationId,
          jobIds,
          redirectTo: inviteAcceptLandingPath(role, {
            jobId: jobIds.length === 1 ? jobIds[0] : null,
            sharedJobIds: jobIds
          }),
          invitesRepaired: Number(result.invitesRepaired || 0),
          membershipUpserts: Number(result.membershipUpserts || 0),
          accessUpserts: Number(result.accessUpserts || 0),
          profileUpdated: Boolean(result.profileUpdated),
          error: result.error ? String(result.error) : undefined,
          source: 'rpc'
        };
      }
    }
  } catch {
    // Fall through to admin mirror when RPC is not deployed yet.
  }

  return repairViaAdmin(admin, userId, emailHint);
}
