type AuthErrorResult = {
  title: string;
  message: string;
  details?: string;
};

const FRIENDLY: Record<string, AuthErrorResult> = {
  invalid_credentials: {
    title: 'Sign in failed',
    message: 'The email or password is incorrect. Check both fields and try again.',
    details: 'Supabase returned invalid login credentials.'
  },
  email_not_confirmed: {
    title: 'Email not verified',
    message: 'Confirm your email address before signing in. Check your inbox for the verification link.',
    details: 'Supabase requires email confirmation for this account.'
  },
  user_banned: {
    title: 'Account restricted',
    message: 'This account cannot sign in. Contact support if you believe this is a mistake.',
    details: 'Supabase marked the user as banned.'
  },
  too_many_requests: {
    title: 'Too many attempts',
    message: 'Wait a minute and try again.',
    details: 'Supabase rate-limited sign-in attempts.'
  },
  missing_auth_code: {
    title: 'Link incomplete',
    message: 'This sign-in link is missing required information. Request a new link and try again.',
    details: 'No auth code was present in the callback URL.'
  },
  account_disabled: {
    title: 'Account disabled',
    message: 'This account has been deactivated. Contact support to restore access.',
    details: 'profiles.account_status is disabled.'
  },
  config_error: {
    title: 'Service unavailable',
    message: 'Authentication is not configured for this environment. Contact your administrator.',
    details: 'Missing or placeholder Supabase environment variables.'
  },
  schema_mismatch: {
    title: 'Database schema out of date',
    message:
      'Sign-in succeeded but the production database is missing required profile columns. Run the latest Supabase migration, then sign in again.',
    details: 'A profiles column referenced by the app does not exist in Supabase.'
  },
  supabase_unreachable: {
    title: 'Supabase connection failed',
    message: 'This deployment cannot reach Supabase. Verify NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel, confirm the Supabase project is active, then redeploy.',
    details: 'Supabase auth client returned fetch failed.'
  },
  session_missing: {
    title: 'Session expired',
    message: 'Your session expired. Sign in again to continue.',
    details: 'No valid Supabase session was found.'
  },
  reset_link_expired: {
    title: 'Reset link expired',
    message: 'This password reset link has expired. Request a new one from the forgot password page.',
    details: 'Auth code exchange failed or OTP expired.'
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
  if (lower.includes('email not confirmed')) return 'email_not_confirmed';
  if (lower.includes('user banned')) return 'user_banned';
  if (lower.includes('rate limit') || lower.includes('too many')) return 'too_many_requests';
  if (lower.includes('disabled')) return 'account_disabled';
  if (lower.includes('placeholder') || lower.includes('not configured')) return 'config_error';
  if (lower.includes('expired') || lower.includes('invalid') && lower.includes('link')) {
    return 'reset_link_expired';
  }
  return '';
}

export function mapAuthError(raw: string | null | undefined, fallbackKey?: keyof typeof FRIENDLY): AuthErrorResult {
  if (!raw) {
    return FRIENDLY[fallbackKey || 'invalid_credentials'];
  }

  const key = normalizeKey(raw);
  if (key && FRIENDLY[key]) {
    return { ...FRIENDLY[key], details: raw };
  }

  return {
    title: 'Something went wrong',
    message: 'We could not complete sign in. Try again or use forgot password.',
    details: raw
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
      message: 'Your account exists in Supabase Auth but EverittOS could not finish workspace setup. Try signing in again or contact support.',
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
    disabled: FRIENDLY.account_disabled
  };

  return ACCESS[code || ''] || {
    title: 'Access blocked',
    message: 'You do not have access to this page.',
    details: code || undefined
  };
}
