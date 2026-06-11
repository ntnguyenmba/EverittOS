import type { SupabaseClient } from '@supabase/supabase-js';
import { isAccountActive } from '@/lib/account-status';
import { logAuthEvent } from '@/lib/auth-logger';
import { normalizePlan } from '@/lib/everittos-plans';
import { normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';

export type WorkspaceProfile = {
  role: string;
  plan: string;
  account_status: string;
  subscription_status: string;
  organization_id: string | null;
};

type ProfileRow = {
  role?: string | null;
  plan?: string | null;
  account_status?: string | null;
  subscription_status?: string | null;
  organization_id?: string | null;
  business_name?: string | null;
};

type MembershipRow = {
  organization_id?: string | null;
  role?: string | null;
  active?: boolean | null;
};

export type BootstrapResult =
  | { ok: true; profile: WorkspaceProfile; created: boolean }
  | {
      ok: false;
      code: string;
      message: string;
      details?: string;
      profileSnapshot?: {
        role?: string | null;
        organization_id?: string | null;
        account_status?: string | null;
        plan?: string | null;
      } | null;
      hasMembership?: boolean;
    };

function profileNeedsSetup(profile: {
  role?: string | null;
  plan?: string | null;
  account_status?: string | null;
} | null): boolean {
  if (!profile) return true;
  if (!profile.role?.trim()) return true;
  if (!profile.plan?.trim()) return true;
  if (!profile.account_status?.trim()) return true;
  return false;
}

function toWorkspaceProfile(profile: ProfileRow, orgId?: string | null): WorkspaceProfile {
  return {
    role: profile.role || 'owner',
    plan: profile.plan || 'free',
    account_status: profile.account_status || 'active',
    subscription_status: profile.subscription_status || 'free',
    organization_id: profile.organization_id || orgId || null
  };
}

async function readWorkspace(
  client: SupabaseClient,
  userId: string
): Promise<{ profile: ProfileRow | null; membership: MembershipRow | null; readError?: string }> {
  const { data: profile, error: readError } = await client
    .from('profiles')
    .select('role, plan, account_status, subscription_status, organization_id, business_name')
    .eq('id', userId)
    .maybeSingle();

  if (readError) {
    return { profile: null, membership: null, readError: readError.message };
  }

  const { data: membership } = await client
    .from('organization_members')
    .select('organization_id, role, active')
    .eq('user_id', userId)
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  return { profile: profile ?? null, membership: membership ?? null };
}

export function isWorkspaceComplete(profile: WorkspaceProfile | null, hasMembership: boolean): boolean {
  if (!profile) return false;
  if (profileNeedsSetup(profile)) return false;
  if (!profile.organization_id && !hasMembership) return false;
  return true;
}

function workspaceIsReady(profile: ProfileRow | null, membership: MembershipRow | null): boolean {
  if (!profile || profileNeedsSetup(profile)) return false;
  const orgId = profile.organization_id || membership?.organization_id;
  if (!orgId) return false;
  if (!membership?.active && !profile.organization_id) return false;
  return true;
}

/**
 * Ensures profiles + organization + membership exist for an authenticated user.
 * Reads with the user session first; uses service role only when bootstrap is required.
 */
export async function ensureUserWorkspace(
  userId: string,
  email: string,
  metadata?: Record<string, unknown>,
  sessionClient?: SupabaseClient
): Promise<BootstrapResult> {
  let existing: ProfileRow | null = null;
  let membership: MembershipRow | null = null;

  if (sessionClient) {
    const sessionRead = await readWorkspace(sessionClient, userId);
    existing = sessionRead.profile;
    membership = sessionRead.membership;

    if (sessionRead.readError) {
      logAuthEvent('profile_read_session_failed', { userId, reason: sessionRead.readError });
    } else if (workspaceIsReady(existing, membership)) {
      const profile = toWorkspaceProfile(existing!, existing!.organization_id || membership?.organization_id);
      if (!isAccountActive(profile.account_status)) {
        return {
          ok: false,
          code: 'account_disabled',
          message: 'This account is deactivated. Contact support to restore access.',
          details: `account_status=${profile.account_status}`,
          profileSnapshot: existing,
          hasMembership: Boolean(membership)
        };
      }

      logAuthEvent('workspace_session_ok', { userId, orgId: profile.organization_id || 'none' });
      return { ok: true, created: false, profile };
    }
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return {
      ok: false,
      code: 'bootstrap_unavailable',
      message:
        'Your account signed in, but workspace setup is unavailable on this server. Add SUPABASE_SERVICE_ROLE_KEY in Vercel and redeploy, or contact support.',
      details: 'SUPABASE_SERVICE_ROLE_KEY is not configured.',
      profileSnapshot: existing,
      hasMembership: Boolean(membership?.active)
    };
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!existing) {
    const adminRead = await readWorkspace(admin, userId);
    if (adminRead.readError) {
      logAuthEvent('profile_read_failed', { userId, reason: adminRead.readError });
      return {
        ok: false,
        code: 'profile_read_failed',
        message: 'We could not load your account profile. Try again or contact support.',
        details: adminRead.readError,
        profileSnapshot: null,
        hasMembership: false
      };
    }
    existing = adminRead.profile;
    membership = adminRead.membership;
  }

  const businessName =
    existing?.business_name?.trim() ||
    (typeof metadata?.business_name === 'string' ? metadata.business_name.trim() : '') ||
    normalizedEmail.split('@')[0] ||
    'My Business';

  const selectedPlan = normalizePlan(
    (typeof metadata?.selected_plan === 'string' ? metadata.selected_plan : null) || existing?.plan || 'free'
  );

  const role = normalizeRole(existing?.role || membership?.role || 'owner');
  let orgId = existing?.organization_id || membership?.organization_id || null;
  let created = profileNeedsSetup(existing) || !orgId || !membership;

  const { error: profileUpsertError } = await admin.from('profiles').upsert(
    {
      id: userId,
      email: normalizedEmail,
      business_name: businessName,
      role: roleToDb(role),
      plan: selectedPlan,
      subscription_status: existing?.subscription_status || (selectedPlan === 'free' ? 'free' : 'incomplete'),
      account_status: existing?.account_status || 'active'
    },
    { onConflict: 'id' }
  );

  if (profileUpsertError) {
    logAuthEvent('profile_bootstrap_failed', { userId, reason: profileUpsertError.message });
    return {
      ok: false,
      code: 'profile_upsert_failed',
      message: 'We could not create your account profile. Contact support with your sign-in email.',
      details: profileUpsertError.message,
      profileSnapshot: existing ?? null,
      hasMembership: Boolean(membership)
    };
  }

  if (!orgId) {
    const { data: org, error: orgError } = await admin
      .from('organizations')
      .insert({ name: businessName, owner_user_id: userId })
      .select('id')
      .single();

    if (orgError || !org) {
      logAuthEvent('org_bootstrap_failed', { userId, reason: orgError?.message || 'no org row' });
      return {
        ok: false,
        code: 'org_create_failed',
        message: 'Your profile exists but workspace organization setup failed. Contact support to finish setup.',
        details: orgError?.message || 'Organization insert returned no row.',
        profileSnapshot: existing ?? null,
        hasMembership: Boolean(membership)
      };
    }
    orgId = org.id;
    created = true;
  }

  const memberRole = membership?.role || roleToDb(role);

  const { error: memberError } = await admin.from('organization_members').upsert(
    {
      organization_id: orgId,
      user_id: userId,
      role: memberRole,
      active: true
    },
    { onConflict: 'organization_id,user_id' }
  );

  if (memberError) {
    logAuthEvent('membership_bootstrap_failed', { userId, reason: memberError.message });
    return {
      ok: false,
      code: 'membership_upsert_failed',
      message: 'Your account profile exists but organization access was not granted. Contact support.',
      details: memberError.message,
      profileSnapshot: existing ?? null,
      hasMembership: Boolean(membership)
    };
  }

  await admin.from('organization_settings').upsert({ organization_id: orgId }, { onConflict: 'organization_id' });

  await admin.from('business_profiles').upsert(
    {
      user_id: userId,
      business_name: businessName,
      email: normalizedEmail
    },
    { onConflict: 'user_id' }
  );

  const { data: finalProfile, error: linkError } = await admin
    .from('profiles')
    .update({ organization_id: orgId, role: memberRole })
    .eq('id', userId)
    .select('role, plan, account_status, subscription_status, organization_id')
    .single();

  if (linkError || !finalProfile) {
    return {
      ok: false,
      code: 'profile_link_failed',
      message: 'Workspace setup did not finish linking your organization. Try signing in again.',
      details: linkError?.message || 'Profile update returned no row.',
      profileSnapshot: existing ?? null,
      hasMembership: Boolean(membership)
    };
  }

  if (!isAccountActive(finalProfile.account_status)) {
    return {
      ok: false,
      code: 'account_disabled',
      message: 'This account is deactivated. Contact support to restore access.',
      details: `account_status=${finalProfile.account_status}`,
      profileSnapshot: finalProfile,
      hasMembership: true
    };
  }

  logAuthEvent('workspace_bootstrap_ok', { userId, created: created ? 1 : 0, orgId });

  return {
    ok: true,
    created,
    profile: {
      role: finalProfile.role || memberRole,
      plan: finalProfile.plan || selectedPlan,
      account_status: finalProfile.account_status || 'active',
      subscription_status: finalProfile.subscription_status || 'free',
      organization_id: finalProfile.organization_id || orgId
    }
  };
}

function roleToDb(role: ReturnType<typeof normalizeRole>): string {
  return role;
}
