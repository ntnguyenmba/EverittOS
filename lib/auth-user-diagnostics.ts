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
