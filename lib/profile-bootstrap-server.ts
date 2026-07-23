import type { SupabaseClient } from '@supabase/supabase-js';
import { isAccountActive } from '@/lib/account-status';
import { asSqlError, logBootstrapException, logBootstrapOperation } from '@/lib/bootstrap-log';
import { logAuthEvent } from '@/lib/auth-logger';
import { normalizePlan } from '@/lib/everittos-plans';
import {
  fetchProfileByUserId,
  isMissingColumnError,
  resolveProfilePlan,
  resolveProfileSubscriptionStatus,
  type ProfileRow,
  updateProfileLink,
  upsertProfileRow
} from '@/lib/profile-query';
import { defaultWorkspaceName } from '@/lib/personal-workspace';
import { normalizeRole, roleToDb } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';

export type WorkspaceProfile = {
  role: string;
  plan: string;
  account_status: string;
  subscription_status: string;
  organization_id: string | null;
  deleted_at: string | null;
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
      retryable?: boolean;
      profileSnapshot?: {
        role?: string | null;
        organization_id?: string | null;
        account_status?: string | null;
        plan?: string | null;
      } | null;
      hasMembership?: boolean;
    };

const RETRYABLE_CODES = new Set([
  'profile_upsert_failed',
  'org_create_failed',
  'membership_upsert_failed',
  'profile_link_failed'
]);

export function isRetryableBootstrapCode(code: string): boolean {
  return RETRYABLE_CODES.has(code);
}

function profileNeedsSetup(profile: { role?: string | null; account_status?: string | null } | null): boolean {
  if (!profile) return true;
  if (!profile.role?.trim()) return true;
  if (!profile.account_status?.trim()) return true;
  return false;
}

async function toWorkspaceProfile(
  client: SupabaseClient,
  userId: string,
  profile: ProfileRow,
  orgId?: string | null
): Promise<WorkspaceProfile> {
  const [plan, subscriptionStatus] = await Promise.all([
    resolveProfilePlan(client, userId, profile),
    resolveProfileSubscriptionStatus(client, userId, profile)
  ]);

  return {
    role: profile.role || 'owner',
    plan,
    account_status: profile.account_status || 'active',
    subscription_status: subscriptionStatus,
    organization_id: profile.organization_id || orgId || null,
    deleted_at: profile.deleted_at || null
  };
}

async function readMembership(
  client: SupabaseClient,
  userId: string
): Promise<{ membership: MembershipRow | null; error?: string }> {
  const { data: membership, error } = await client
    .from('organization_members')
    .select('organization_id, role, active')
    .eq('user_id', userId)
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    return { membership: null, error: error.message };
  }

  return { membership: membership ?? null };
}

async function readWorkspace(
  client: SupabaseClient,
  userId: string
): Promise<{
  profile: ProfileRow | null;
  membership: MembershipRow | null;
  readError?: string;
  schemaMismatch?: { column: string; message: string };
}> {
  const profileRead = await fetchProfileByUserId(client, userId);
  if (profileRead.error) {
    return {
      profile: null,
      membership: null,
      readError: profileRead.error,
      schemaMismatch: profileRead.schemaMismatch
    };
  }

  const membershipRead = await readMembership(client, userId);
  if (membershipRead.error) {
    return {
      profile: profileRead.profile,
      membership: null,
      readError: membershipRead.error
    };
  }

  return {
    profile: profileRead.profile,
    membership: membershipRead.membership,
    schemaMismatch: profileRead.schemaMismatch
  };
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

function failure(
  code: string,
  message: string,
  details?: string,
  profileSnapshot?: ProfileRow | null,
  hasMembership?: boolean
): BootstrapResult {
  return {
    ok: false,
    code,
    message,
    details,
    retryable: isRetryableBootstrapCode(code),
    profileSnapshot,
    hasMembership
  };
}

function schemaMismatchFailure(
  message: string,
  profileSnapshot?: ProfileRow | null,
  hasMembership?: boolean
): BootstrapResult {
  return failure(
    'schema_mismatch',
    'Your account signed in, but the database schema is missing required profile columns. Run the latest Supabase migration, then sign in again.',
    message,
    profileSnapshot,
    hasMembership
  );
}

function profileReadFailure(
  message: string,
  profileSnapshot?: ProfileRow | null,
  hasMembership?: boolean
): BootstrapResult {
  if (isMissingColumnError(message)) {
    return schemaMismatchFailure(message, profileSnapshot, hasMembership);
  }

  return failure(
    'profile_read_failed',
    'We could not load your account profile. Try again or contact support.',
    message,
    profileSnapshot,
    hasMembership
  );
}

async function resolveOrganizationId(
  admin: SupabaseClient,
  userId: string,
  existing: ProfileRow | null,
  membership: MembershipRow | null
): Promise<string | null> {
  const fromProfile = existing?.organization_id || membership?.organization_id || null;
  if (fromProfile) {
    logBootstrapOperation({
      step: 'resolve_org_id',
      table: 'profiles|organization_members',
      action: 'select',
      userId,
      ok: true,
      meta: { orgId: fromProfile, source: 'profile_or_membership' }
    });
    return fromProfile;
  }

  const { data: ownedOrg, error: ownedError } = await admin
    .from('organizations')
    .select('id')
    .eq('owner_user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  logBootstrapOperation({
    step: 'resolve_org_id',
    table: 'organizations',
    action: 'select',
    userId,
    ok: !ownedError,
    error: asSqlError(ownedError),
    meta: { source: 'owner_user_id', found: ownedOrg?.id ? 1 : 0 }
  });

  if (ownedOrg?.id) return ownedOrg.id;

  const { data: anyMembership, error: memberError } = await admin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  logBootstrapOperation({
    step: 'resolve_org_id',
    table: 'organization_members',
    action: 'select',
    userId,
    ok: !memberError,
    error: asSqlError(memberError),
    meta: { source: 'any_membership', found: anyMembership?.organization_id ? 1 : 0 }
  });

  return anyMembership?.organization_id ?? null;
}

async function ensureOrganizationSettings(
  admin: SupabaseClient,
  userId: string,
  orgId: string
): Promise<{ warning?: string }> {
  const settingsPayload: Record<string, unknown> = {
    organization_id: orgId,
    onboarding_step: 0,
    onboarding_completed: false
  };

  const { error: settingsFullError } = await admin
    .from('organization_settings')
    .upsert({ ...settingsPayload, onboarding_skipped: false }, { onConflict: 'organization_id' });

  if (settingsFullError && isMissingColumnError(settingsFullError.message)) {
    const { error: settingsCoreError } = await admin
      .from('organization_settings')
      .upsert(settingsPayload, { onConflict: 'organization_id' });

    logBootstrapOperation({
      step: 'ensure_org_settings',
      table: 'organization_settings',
      action: 'upsert',
      userId,
      ok: !settingsCoreError,
      error: asSqlError(settingsCoreError),
      meta: { fallback: 'core_columns' }
    });

    if (settingsCoreError) {
      return { warning: settingsCoreError.message };
    }
    return {};
  }

  logBootstrapOperation({
    step: 'ensure_org_settings',
    table: 'organization_settings',
    action: 'upsert',
    userId,
    ok: !settingsFullError,
    error: asSqlError(settingsFullError)
  });

  if (settingsFullError) {
    return { warning: settingsFullError.message };
  }

  return {};
}

async function linkProfileToOrganization(
  admin: SupabaseClient,
  userId: string,
  orgId: string,
  role: string,
  existing: ProfileRow | null,
  hasMembership: boolean
): Promise<BootstrapResult | { profile: ProfileRow }> {
  const linkResult = await updateProfileLink(admin, userId, orgId, roleToDb(normalizeRole(role)));

  logBootstrapOperation({
    step: 'link_profile_org',
    table: 'profiles',
    action: 'update',
    userId,
    ok: !linkResult.error && Boolean(linkResult.profile),
    error: asSqlError(linkResult.error),
    meta: { orgId, role }
  });

  if (linkResult.error || !linkResult.profile) {
    if (linkResult.schemaMismatch) {
      return schemaMismatchFailure(linkResult.schemaMismatch.message, existing, hasMembership);
    }
    return failure(
      'profile_link_failed',
      'Workspace setup did not finish linking your organization. Try signing in again.',
      linkResult.error || 'Profile update returned no row.',
      existing,
      hasMembership
    );
  }

  return { profile: linkResult.profile };
}

/**
 * Ensures profiles + organization + membership exist for an authenticated user.
 * Idempotent: repairs partial signup state on every login/setup call.
 */
export async function ensureUserWorkspace(
  userId: string,
  email: string,
  metadata?: Record<string, unknown>,
  sessionClient?: SupabaseClient
): Promise<BootstrapResult> {
  try {
    let existing: ProfileRow | null = null;
    let membership: MembershipRow | null = null;

    if (sessionClient) {
      const sessionRead = await readWorkspace(sessionClient, userId);
      existing = sessionRead.profile;
      membership = sessionRead.membership;

      if (sessionRead.readError) {
        logAuthEvent('profile_read_session_failed', { userId, reason: sessionRead.readError });
        return profileReadFailure(sessionRead.readError, existing, Boolean(membership?.active));
      }

      if (workspaceIsReady(existing, membership)) {
        const orgId = existing!.organization_id || membership?.organization_id || null;

        if (!existing!.organization_id && orgId && sessionClient) {
          const admin = createAdminSupabase();
          if (admin) {
            const repaired = await linkProfileToOrganization(
              admin,
              userId,
              orgId,
              existing!.role || membership?.role || 'owner',
              existing,
              Boolean(membership)
            );
            if ('profile' in repaired) {
              existing = repaired.profile;
            }
          }
        }

        const profile = await toWorkspaceProfile(sessionClient, userId, existing!, orgId);

        if (!isAccountActive(profile.account_status)) {
          return failure(
            'account_disabled',
            'This account is deactivated. Contact support to restore access.',
            `account_status=${profile.account_status}`,
            existing,
            Boolean(membership)
          );
        }

        logAuthEvent('workspace_session_ok', { userId, orgId: profile.organization_id || 'none' });
        return { ok: true, created: false, profile };
      }
    }

    const admin = createAdminSupabase();
    if (!admin) {
      return failure(
        'bootstrap_unavailable',
        'Your account signed in, but workspace setup is unavailable on this server. Contact support to finish setup.',
        'SUPABASE_SERVICE_ROLE_KEY is not configured.',
        existing,
        Boolean(membership?.active)
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailDomain = normalizedEmail.includes('@')
      ? normalizedEmail.split('@')[1] || 'unknown'
      : 'unknown';

    if (!existing) {
      const adminRead = await readWorkspace(admin, userId);
      if (adminRead.readError) {
        logAuthEvent('profile_read_failed', { userId, reason: adminRead.readError });
        return profileReadFailure(adminRead.readError, adminRead.profile, Boolean(adminRead.membership?.active));
      }
      existing = adminRead.profile;
      membership = adminRead.membership;
    }

    const businessName = defaultWorkspaceName({
      email: normalizedEmail,
      businessName: existing?.business_name,
      metadata
    });

    const selectedPlan = normalizePlan(
      (typeof metadata?.selected_plan === 'string' ? metadata.selected_plan : null) ||
        existing?.plan ||
        (await resolveProfilePlan(admin, userId, existing))
    );

    const role = normalizeRole(existing?.role || membership?.role || 'owner');
    let orgId = await resolveOrganizationId(admin, userId, existing, membership);
    let created = profileNeedsSetup(existing) || !orgId || !membership?.active;

    const upsertResult = await upsertProfileRow(admin, {
      id: userId,
      email: normalizedEmail,
      business_name: businessName,
      role: roleToDb(role),
      account_status: existing?.account_status || 'active',
      plan: selectedPlan,
      subscription_status:
        existing?.subscription_status || (selectedPlan === 'free' ? 'free' : 'incomplete')
    });

    logBootstrapOperation({
      step: 'ensure_profile',
      table: 'profiles',
      action: 'upsert',
      userId,
      emailDomain,
      ok: !upsertResult.error,
      error: asSqlError(upsertResult.error),
      meta: { role: roleToDb(role), plan: selectedPlan }
    });

    if (upsertResult.error) {
      logAuthEvent('profile_bootstrap_failed', { userId, reason: upsertResult.error });
      if (upsertResult.schemaMismatch) {
        return schemaMismatchFailure(upsertResult.schemaMismatch.message, existing, Boolean(membership));
      }
      return failure(
        'profile_upsert_failed',
        'We could not finish setting up your workspace profile. Try signing in again.',
        upsertResult.error,
        existing ?? null,
        Boolean(membership)
      );
    }

    if (profileNeedsSetup(existing)) {
      logAuthEvent('profile_created', { userId, emailDomain });
    }

    if (!orgId) {
      // Re-check owned org before insert to reduce duplicate-workspace races
      // when parallel bootstrap/setup requests run for the same user.
      const { data: ownedAgain } = await admin
        .from('organizations')
        .select('id')
        .eq('owner_user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (ownedAgain?.id) {
        orgId = ownedAgain.id;
      } else {
        const { data: org, error: orgError } = await admin
          .from('organizations')
          .insert({ name: businessName, owner_user_id: userId })
          .select('id')
          .single();

        logBootstrapOperation({
          step: 'create_organization',
          table: 'organizations',
          action: 'insert',
          userId,
          emailDomain,
          ok: !orgError && Boolean(org?.id),
          error: asSqlError(orgError),
          meta: { businessName }
        });

        if (orgError || !org) {
          // Another concurrent request may have created the org first.
          const { data: racedOrg } = await admin
            .from('organizations')
            .select('id')
            .eq('owner_user_id', userId)
            .is('deleted_at', null)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (racedOrg?.id) {
            orgId = racedOrg.id;
          } else {
            logAuthEvent('org_bootstrap_failed', { userId, reason: orgError?.message || 'no org row' });
            return failure(
              'org_create_failed',
              'Your profile was created but workspace organization setup failed. Try signing in again.',
              orgError?.message || 'Organization insert returned no row.',
              existing ?? null,
              Boolean(membership)
            );
          }
        } else {
          orgId = org.id;
          created = true;
          logAuthEvent('workspace_created', { userId, emailDomain, orgId });
        }
      }
    }

    const memberRole = roleToDb(normalizeRole(membership?.role || role));

    const { error: memberError } = await admin.from('organization_members').upsert(
      {
        organization_id: orgId,
        user_id: userId,
        role: memberRole,
        active: true
      },
      { onConflict: 'organization_id,user_id' }
    );

    logBootstrapOperation({
      step: 'ensure_membership',
      table: 'organization_members',
      action: 'upsert',
      userId,
      emailDomain,
      ok: !memberError,
      error: asSqlError(memberError),
      meta: { orgId, role: memberRole }
    });

    if (memberError) {
      logAuthEvent('membership_bootstrap_failed', { userId, reason: memberError.message });
      return failure(
        'membership_upsert_failed',
        'Your account profile exists but organization access was not granted. Try signing in again.',
        memberError.message,
        existing ?? null,
        Boolean(membership)
      );
    }

    if (!orgId) {
      return failure(
        'org_create_failed',
        'Workspace organization was not created. Try signing in again.',
        'Organization id missing after membership upsert.',
        existing ?? null,
        true
      );
    }

    const resolvedOrgId = orgId;
    const settingsResult = await ensureOrganizationSettings(admin, userId, resolvedOrgId);
    if (settingsResult.warning) {
      logAuthEvent('org_settings_bootstrap_failed', { userId, reason: settingsResult.warning });
    }

    const { error: businessProfileError } = await admin.from('business_profiles').upsert(
      {
        user_id: userId,
        business_name: businessName,
        email: normalizedEmail
      },
      { onConflict: 'user_id' }
    );

    logBootstrapOperation({
      step: 'ensure_business_profile',
      table: 'business_profiles',
      action: 'upsert',
      userId,
      ok: !businessProfileError,
      error: asSqlError(businessProfileError)
    });

    const linked = await linkProfileToOrganization(
      admin,
      userId,
      resolvedOrgId,
      memberRole,
      existing,
      true
    );
    if (!('profile' in linked)) {
      return linked;
    }

    const finalProfile = await toWorkspaceProfile(admin, userId, linked.profile, resolvedOrgId);

    if (!isAccountActive(finalProfile.account_status)) {
      return failure(
        'account_disabled',
        'This account is deactivated. Contact support to restore access.',
        `account_status=${finalProfile.account_status}`,
        linked.profile,
        true
      );
    }

    logAuthEvent('workspace_bootstrap_ok', { userId, created: created ? 1 : 0, orgId: resolvedOrgId });

    return {
      ok: true,
      created,
      profile: finalProfile
    };
  } catch (err) {
    logBootstrapException('ensure_user_workspace', userId, err);
    return failure(
      'bootstrap_exception',
      'Workspace setup failed due to a server error. Try signing in again.',
      err instanceof Error ? err.message : String(err)
    );
  }
}
