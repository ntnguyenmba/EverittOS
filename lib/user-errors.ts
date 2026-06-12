/** Map raw API/Supabase errors to user-friendly copy. */

export function friendlyErrorMessage(raw: string | null | undefined, fallback = 'Something went wrong. Try again.'): string {
  if (!raw?.trim()) return fallback;

  const lower = raw.toLowerCase();

  if (lower === 'load failed' || lower === 'failed to fetch' || lower.includes('networkerror')) {
    return 'Unable to connect to the server. Check your connection and try again.';
  }

  if (lower.includes('invalid login credentials')) {
    return 'Your email or password is incorrect.';
  }

  if (lower.includes('email not confirmed')) {
    return 'Your account has not been verified. Check your inbox for the confirmation link.';
  }

  if (lower.includes('user already registered')) {
    return 'An account with this email already exists. Sign in or reset your password.';
  }

  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many attempts. Wait a minute and try again.';
  }

  if (lower.includes('jwt') || lower.includes('session')) {
    return 'Your session expired. Sign in again to continue.';
  }

  if (lower.includes('permission') || lower.includes('rls') || lower.includes('row-level security')) {
    return 'You do not have permission to perform this action.';
  }

  if (lower.includes('company_id')) {
    return 'Workspace setup is still finishing. Refresh the page and try again.';
  }

  return raw;
}
