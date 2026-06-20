type AuthErrorResult = {
  title: string;
  message: string;
  details?: string;
  code?: string;
};

const FRIENDLY: Record<string, AuthErrorResult> = {
  invalid_credentials: {
    title: 'Sign in failed',
    message: 'The email or password is incorrect.',
    details: 'Supabase returned invalid login credentials.',
    code: 'invalid_credentials'
  },
  email_not_confirmed: {
    title: 'Email not verified',
    message: 'Confirm your email address before signing in. Check your inbox for the verification link.',
    details: 'Supabase requires email confirmation for this account.',
    code: 'email_not_confirmed'
  },
  user_banned: {
    title: 'Account restricted',
    message: 'This account cannot sign in. Contact support if you believe this is a mistake.',
    details: 'Supabase marked the user as banned.',
    code: 'user_banned'
  },
  too_many_requests: {
    title: 'Too many attempts',
    message: 'Wait a minute and try again.',
    details: 'Supabase rate-limited sign-in attempts.',
    code: 'too_many_requests'
  },
  missing_auth_code: {
    title: 'Link incomplete',
    message: 'This sign-in link is missing required information. Request a new link and try again.',
    details: 'No auth code was present in the callback URL.',
    code: 'missing_auth_code'
  },
  account_disabled: {
    title: 'Account disabled',
    message: 'This account is disabled. Contact support if this looks wrong.',
    details: 'profiles.account_status is disabled.',
    code: 'account_disabled'
  },
  account_deleted: {
    title: 'Account deleted',
    message: 'This account has been deleted. Contact support during the recovery window to restore access.',
    details: 'profiles.deleted_at is set.',
    code: 'account_deleted'
  },
  config_error: {
    title: 'Service unavailable',
    message: 'Authentication is not configured for this environment. Contact your administrator.',
    details: 'Missing or placeholder Supabase environment variables.',
    code: 'config_error'
  },
  schema_mismatch: {
    title: 'Database schema out of date',
    message:
      'Sign-in succeeded but the production database is missing required profile columns. Run the latest Supabase migration, then sign in again.',
    details: 'A profiles column referenced by the app does not exist in Supabase.',
    code: 'schema_mismatch'
  },
  supabase_unreachable: {
    title: 'Connection problem',
    message:
      'We could not reach the authentication service. Check your connection and try again, or contact support if this continues.',
    details: 'Supabase auth client returned fetch failed.',
    code: 'supabase_unreachable'
  },
  session_missing: {
    title: 'Session expired',
    message: 'Your session expired. Sign in again to continue.',
    details: 'No valid Supabase session was found.',
    code: 'session_missing'
  },
  reset_link_expired: {
    title: 'Reset link expired',
    message: 'This password reset link has expired. Request a new one from the forgot password page.',
    details: 'Auth code exchange failed or OTP expired.',
    code: 'reset_link_expired'
  },
  pkce_flow_expired: {
    title: 'Confirmation link expired',
    message:
      'This email confirmation link expired or was opened in a different browser. Sign in with your email and password instead.',
    details: 'PKCE flow state was missing or expired during code exchange.',
    code: 'pkce_flow_expired'
  },
  existing_unconfirmed: {
    title: 'Account already exists',
    message:
      'Account already exists. Check your email for the confirmation link or sign in.',
    details: 'Supabase Auth user exists but email is not confirmed.',
    code: 'existing_unconfirmed'
  },
  existing_confirmed: {
    title: 'Account already exists',
    message: 'An account already exists with this email. Sign in instead.',
    details: 'Supabase Auth user exists and email is confirmed.',
    code: 'existing_confirmed'
  },
  existing_incomplete: {
    title: 'Account already exists',
    message:
      'An account already exists with this email. Sign in to finish setup — we will repair your workspace automatically.',
    details: 'Auth user exists but profile or workspace setup is incomplete.',
    code: 'existing_incomplete'
  },
  signup_failed: {
    title: 'Signup failed',
    message: 'We could not create your account. Try again or contact support if this continues.',
    details: 'Unhandled signup error from Supabase Auth.',
    code: 'signup_failed'
  },
  auth_error: {
    title: 'Authentication failed',
    message: 'Something went wrong. Try again or contact support if this continues.',
    details: 'Unhandled authentication error.',
    code: 'auth_error'
  }
};

function normalizeKey(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
    return 'invalid_credentials';
  }
  if (lower.includes('fetch failed') || lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return 'supabase_unreachable';
  }
  if (lower.includes('email not confirmed') || lower.includes('email_not_confirmed')) return 'email_not_confirmed';
  if (lower.includes('user banned')) return 'user_banned';
  if (lower.includes('rate limit') || lower.includes('too many')) return 'too_many_requests';
  if (lower.includes('disabled')) return 'account_disabled';
  if (lower.includes('placeholder') || lower.includes('not configured')) return 'config_error';
  if (
    lower.includes('flow state') ||
    lower.includes('flow_state') ||
    lower.includes('pkce') ||
    lower.includes('code verifier') ||
    lower.includes('invalid grant')
  ) {
    return 'pkce_flow_expired';
  }
  if (lower.includes('expired') && (lower.includes('link') || lower.includes('otp') || lower.includes('token'))) {
    return 'reset_link_expired';
  }
  if (
    lower.includes('user already registered') ||
    lower.includes('already been registered') ||
    lower.includes('email address is already registered')
  ) {
    return 'existing_confirmed';
  }
  return '';
}

export function mapAuthErrorByCode(code: string | null | undefined): AuthErrorResult | null {
  if (!code) return null;
  const entry = FRIENDLY[code];
  return entry ? { ...entry, code: entry.code || code } : null;
}

type SignupExistingReason =
  | 'email_not_confirmed'
  | 'email_confirmed'
  | 'account_deleted'
  | 'account_disabled'
  | 'user_banned'
  | 'missing_profile'
  | 'missing_workspace'
  | 'admin_unavailable'
  | 'lookup_error'
  | 'user_not_found';

/** Map signup existing-user diagnosis to user-facing copy (never raw Supabase text). */
export function mapSignupExistingUserError(reason: SignupExistingReason): AuthErrorResult & {
  signInRecommended: boolean;
  resendConfirmation: boolean;
} {
  switch (reason) {
    case 'email_not_confirmed':
      return { ...FRIENDLY.existing_unconfirmed, signInRecommended: true, resendConfirmation: true };
    case 'missing_profile':
    case 'missing_workspace':
      return { ...FRIENDLY.existing_incomplete, signInRecommended: true, resendConfirmation: false };
    case 'account_deleted':
      return { ...FRIENDLY.account_deleted, signInRecommended: true, resendConfirmation: false };
    case 'account_disabled':
      return { ...FRIENDLY.account_disabled, signInRecommended: false, resendConfirmation: false };
    case 'user_banned':
      return { ...FRIENDLY.user_banned, signInRecommended: false, resendConfirmation: false };
    case 'admin_unavailable':
    case 'lookup_error':
    case 'user_not_found':
      return {
        ...FRIENDLY.existing_confirmed,
        signInRecommended: true,
        resendConfirmation: false,
        details: `Diagnosis: ${reason}`
      };
    case 'email_confirmed':
    default:
      return { ...FRIENDLY.existing_confirmed, signInRecommended: true, resendConfirmation: false };
  }
}

/** Prefer the raw Supabase message for display when no friendly mapping exists. */
export function mapAuthError(raw: string | null | undefined, fallbackKey?: keyof typeof FRIENDLY): AuthErrorResult {
  if (!raw) {
    return FRIENDLY[fallbackKey || 'invalid_credentials'];
  }

  const trimmed = raw.trim();
  const key = normalizeKey(trimmed);
  if (key && FRIENDLY[key]) {
    return { ...FRIENDLY[key], details: trimmed, code: FRIENDLY[key].code || key };
  }

  return {
    title: FRIENDLY.auth_error.title,
    message: FRIENDLY.auth_error.message,
    details: trimmed,
    code: 'auth_error'
  };
}

export function mapAccessError(code: string | null | undefined): AuthErrorResult {
  const ACCESS: Record<string, AuthErrorResult> = {
    plan: {
      title: 'Plan upgrade required',
      message: 'Your current plan does not include this feature. Open billing to upgrade.',
      details: 'Route minimum plan not met.'
    },
    subscription: {
      title: 'Subscription issue',
      message: 'Your subscription needs attention before you can use paid features. Update billing to continue.',
      details: 'Subscription status blocks access.'
    },
    role: {
      title: 'Access restricted',
      message: 'Your role does not include permission for this page. Contact your workspace owner.',
      details: 'Role-based route restriction.'
    },
    profile: {
      title: 'Profile setup required',
      message: 'Your sign-in worked, but the workspace profile is incomplete. Sign in again to finish setup, or contact support.',
      details: 'Missing profiles row or organization membership.'
    },
    profile_setup: {
      title: 'Workspace setup required',
      message:
        'Your account was created, but EverittOS could not finish workspace setup. Sign in again to retry, or contact support if this continues.',
      details: 'Profile or organization bootstrap failed on the server.'
    },
    schema: {
      title: 'Database schema out of date',
      message: 'Your session is valid but the database schema is missing columns required by EverittOS. Run the latest Supabase migration.',
      details: 'Profile query referenced a column that does not exist.'
    },
    organization: {
      title: 'Organization access required',
      message: 'Your profile exists but organization access is not active yet. Complete workspace setup to continue.',
      details: 'Missing or inactive organization membership.'
    },
    session: {
      title: 'Sign in required',
      message: 'Sign in to access this page.',
      details: 'No authenticated Supabase session.'
    },
    idle: {
      title: 'Session timed out',
      message: 'You were signed out after a period of inactivity. Sign in again to continue.',
      details: 'Session idle timeout exceeded.'
    },
    disabled: FRIENDLY.account_disabled,
    deleted: FRIENDLY.account_deleted,
    auth: {
      title: 'Email confirmation failed',
      message: 'We could not finish confirming your email. Sign in with your password or request a new confirmation email.',
      details: 'Auth callback returned an error.'
    },
    reset: FRIENDLY.reset_link_expired
  };

  return ACCESS[code || ''] || {
    title: 'Access blocked',
    message: 'You do not have access to this page.',
    details: code || undefined
  };
}
