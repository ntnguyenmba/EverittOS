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

export type BootstrapResult =
  | { ok: true; profile: WorkspaceProfile; created: boolean }
  | { ok: false; code: string; message: string; details?: string };

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

/**
 * Ensures profiles + organization + membership exist for an authenticated user.
 * Uses service role because first organization_members row cannot self-insert under RLS.
 */
export async function ensureUserWorkspace(
  userId: string,
  email: string,
  metadata?: Record<string, unknown>
): Promise<BootstrapResult> {
  const admin = createAdminSupabase();
  if (!admin) {
    return {
      ok: false,
      code: 'bootstrap_unavailable',
      message:
        'Your account signed in, but workspace setup is unavailable on this server. Contact support to finish setup.',
      details: 'SUPABASE_SERVICE_ROLE_KEY is not configured.'
    };
  }

  const normalizedEmail = email.trim().toLowerCase();

  const { data: existing, error: readError } = await admin
    .from('profiles')
    .select('role, plan, account_status, subscription_status, organization_id, business_name')
    .eq('id', userId)
    .maybeSingle();

  if (readError) {
    logAuthEvent('profile_read_failed', { userId, reason: readError.message });
    return {
      ok: false,
      code: 'profile_read_failed',
      message: 'We could not load your account profile. Try again or contact support.',
      details: readError.message
    };
  }

  const { data: membership } = await admin
    .from('organization_members')
    .select('organization_id, role, active')
    .eq('user_id', userId)
    .eq('active', true)
    .limit(1)
    .maybeSingle();

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
      details: profileUpsertError.message
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
        details: orgError?.message || 'Organization insert returned no row.'
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
      details: memberError.message
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
      details: linkError?.message || 'Profile update returned no row.'
    };
  }

  if (!isAccountActive(finalProfile.account_status)) {
    return {
      ok: false,
      code: 'account_disabled',
      message: 'This account is deactivated. Contact support to restore access.',
      details: `account_status=${finalProfile.account_status}`
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

export function isWorkspaceComplete(profile: WorkspaceProfile | null, hasMembership: boolean): boolean {
  if (!profile) return false;
  if (profileNeedsSetup(profile)) return false;
  if (!profile.organization_id && !hasMembership) return false;
  return true;
}
