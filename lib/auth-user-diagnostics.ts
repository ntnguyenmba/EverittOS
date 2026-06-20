import { isAccountDeleted } from '@/lib/account-status';
import { logAuthEvent } from '@/lib/auth-logger';
import { normalizeEmail } from '@/lib/input-validation';
import { createAdminSupabase } from '@/lib/supabase-admin';

export type LoginFailureReason =
  | 'user_not_found'
  | 'email_not_confirmed'
  | 'user_banned'
  | 'password_mismatch'
  | 'admin_unavailable'
  | 'lookup_error';

export type LoginFailureDiagnosis = {
  userExists: boolean;
  emailConfirmed: boolean | null;
  banned: boolean | null;
  profileExists: boolean | null;
  authEmail: string | null;
  reason: LoginFailureReason;
  provider: string | null;
};

async function findAuthUserByEmail(email: string) {
  const admin = createAdminSupabase();
  if (!admin) return { admin: null, user: null, lookupError: 'admin_unavailable' as const };

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (profileError) {
    return { admin, user: null, lookupError: 'lookup_error' as const };
  }

  if (profile?.id) {
    const { data, error } = await admin.auth.admin.getUserById(profile.id);
    if (!error && data.user) {
      return { admin, user: data.user, lookupError: null };
    }
  }

  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      return { admin, user: null, lookupError: 'lookup_error' as const };
    }

    const match = data.users.find((candidate) => normalizeEmail(candidate.email || '') === email);
    if (match) {
      return { admin, user: match, lookupError: null };
    }

    if (data.users.length < 200) break;
  }

  return { admin, user: null, lookupError: null };
}

/** Server-only lookup to explain invalid-credentials failures without exposing secrets. */
export async function diagnoseLoginFailure(email: string): Promise<LoginFailureDiagnosis> {
  const normalized = normalizeEmail(email);
  const empty: LoginFailureDiagnosis = {
    userExists: false,
    emailConfirmed: null,
    banned: null,
    profileExists: null,
    authEmail: null,
    reason: 'admin_unavailable',
    provider: null
  };

  if (!normalized) {
    return { ...empty, reason: 'user_not_found' };
  }

  const { admin, user, lookupError } = await findAuthUserByEmail(normalized);

  if (lookupError === 'admin_unavailable') {
    logAuthEvent('login_failure_diagnosis', {
      reason: 'admin_unavailable',
      emailDomain: normalized.split('@')[1] || 'unknown'
    });
    return { ...empty, reason: 'admin_unavailable' };
  }

  if (lookupError === 'lookup_error') {
    logAuthEvent('login_failure_diagnosis', {
      reason: 'lookup_error',
      emailDomain: normalized.split('@')[1] || 'unknown'
    });
    return { ...empty, reason: 'lookup_error' };
  }

  if (!user) {
    logAuthEvent('login_failure_diagnosis', {
      reason: 'user_not_found',
      emailDomain: normalized.split('@')[1] || 'unknown'
    });
    return { ...empty, reason: 'user_not_found' };
  }

  const emailConfirmed = Boolean(user.email_confirmed_at);
  const banned = Boolean(user.banned_until && new Date(user.banned_until) > new Date());
  const provider = (user.app_metadata?.provider as string | undefined) || 'email';

  let reason: LoginFailureReason = 'password_mismatch';
  if (banned) reason = 'user_banned';
  else if (!emailConfirmed) reason = 'email_not_confirmed';

  const { data: profileRow } = admin
    ? await admin.from('profiles').select('id').eq('id', user.id).maybeSingle()
    : { data: null };

  logAuthEvent('login_failure_diagnosis', {
    reason,
    userExists: 1,
    emailConfirmed: emailConfirmed ? 1 : 0,
    banned: banned ? 1 : 0,
    profileExists: profileRow ? 1 : 0,
    emailDomain: normalized.split('@')[1] || 'unknown',
    provider
  });

  return {
    userExists: true,
    emailConfirmed,
    banned,
    profileExists: Boolean(profileRow),
    authEmail: user.email || null,
    reason,
    provider
  };
}

export type SignupExistingUserReason =
  | 'user_not_found'
  | 'email_not_confirmed'
  | 'email_confirmed'
  | 'account_deleted'
  | 'account_disabled'
  | 'user_banned'
  | 'missing_profile'
  | 'missing_workspace'
  | 'admin_unavailable'
  | 'lookup_error';

export type SignupExistingUserDiagnosis = {
  userExists: boolean;
  emailConfirmed: boolean | null;
  profileExists: boolean | null;
  profileDeleted: boolean | null;
  workspaceComplete: boolean | null;
  banned: boolean | null;
  reason: SignupExistingUserReason;
  userId: string | null;
};

function isExistingUserSignupMessage(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const lower = raw.toLowerCase();
  return (
    lower.includes('user already registered') ||
    lower.includes('already been registered') ||
    lower.includes('email address is already registered') ||
    lower.includes('duplicate') && lower.includes('email')
  );
}

export { isExistingUserSignupMessage };

/** Explain why signup rejected an email that already exists in Supabase Auth. */
export async function diagnoseSignupExistingUser(email: string): Promise<SignupExistingUserDiagnosis> {
  const normalized = normalizeEmail(email);
  const empty: SignupExistingUserDiagnosis = {
    userExists: false,
    emailConfirmed: null,
    profileExists: null,
    profileDeleted: null,
    workspaceComplete: null,
    banned: null,
    reason: 'admin_unavailable',
    userId: null
  };

  if (!normalized) {
    return { ...empty, reason: 'user_not_found' };
  }

  const { admin, user, lookupError } = await findAuthUserByEmail(normalized);

  if (lookupError === 'admin_unavailable') {
    return { ...empty, reason: 'admin_unavailable' };
  }

  if (lookupError === 'lookup_error') {
    return { ...empty, reason: 'lookup_error' };
  }

  if (!user) {
    return { ...empty, reason: 'user_not_found' };
  }

  const emailConfirmed = Boolean(user.email_confirmed_at);
  const banned = Boolean(user.banned_until && new Date(user.banned_until) > new Date());

  const { data: profileRow } = admin
    ? await admin
        .from('profiles')
        .select('id, organization_id, account_status, deleted_at')
        .eq('id', user.id)
        .maybeSingle()
    : { data: null };

  const profileExists = Boolean(profileRow);
  const profileDeleted = profileExists ? isAccountDeleted(profileRow?.deleted_at) : false;

  let workspaceComplete: boolean | null = null;
  if (profileExists && admin && !profileDeleted) {
    const orgId = profileRow?.organization_id;
    if (orgId) {
      const { data: membership } = await admin
        .from('organization_members')
        .select('active')
        .eq('user_id', user.id)
        .eq('organization_id', orgId)
        .eq('active', true)
        .maybeSingle();
      workspaceComplete = Boolean(membership);
    } else {
      const { data: membership } = await admin
        .from('organization_members')
        .select('organization_id, active')
        .eq('user_id', user.id)
        .eq('active', true)
        .limit(1)
        .maybeSingle();
      workspaceComplete = Boolean(membership?.organization_id);
    }
  } else if (profileExists) {
    workspaceComplete = false;
  }

  let reason: SignupExistingUserReason = 'email_confirmed';
  if (banned) reason = 'user_banned';
  else if (profileDeleted) reason = 'account_deleted';
  else if (profileExists && profileRow?.account_status === 'disabled') reason = 'account_disabled';
  else if (!emailConfirmed) reason = 'email_not_confirmed';
  else if (!profileExists) reason = 'missing_profile';
  else if (workspaceComplete === false) reason = 'missing_workspace';

  logAuthEvent('signup_existing_user', {
    reason,
    userId: user.id,
    emailConfirmed: emailConfirmed ? 1 : 0,
    profileExists: profileExists ? 1 : 0,
    profileDeleted: profileDeleted ? 1 : 0,
    workspaceComplete: workspaceComplete === null ? -1 : workspaceComplete ? 1 : 0,
    emailDomain: normalized.split('@')[1] || 'unknown'
  });

  return {
    userExists: true,
    emailConfirmed,
    profileExists,
    profileDeleted,
    workspaceComplete,
    banned,
    reason,
    userId: user.id
  };
}
