const AUTH_KEYS = new Set([
  'invalid_credentials',
  'email_not_confirmed',
  'user_banned',
  'too_many_requests',
  'missing_auth_code',
  'account_disabled',
  'config_error',
  'schema_mismatch',
  'supabase_unreachable',
  'session_missing',
  'reset_link_expired'
]);

const ACCESS_KEYS = new Set([
  'plan',
  'subscription',
  'role',
  'profile',
  'profile_setup',
  'schema',
  'organization',
  'session',
  'idle',
  'disabled'
]);

function normalizeAuthKey(raw: string): string {
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
  if (lower.includes('expired') || (lower.includes('invalid') && lower.includes('link'))) {
    return 'reset_link_expired';
  }
  return '';
}

export function resolveAuthErrorKey(raw: string | null | undefined, fallbackKey?: string): string {
  if (fallbackKey && AUTH_KEYS.has(fallbackKey)) return fallbackKey;
  const key = normalizeAuthKey(raw || '');
  if (key && AUTH_KEYS.has(key)) return key;
  if (fallbackKey && AUTH_KEYS.has(fallbackKey)) return fallbackKey;
  return 'generic';
}

export function resolveAccessErrorKey(code: string | null | undefined): string {
  if (code && ACCESS_KEYS.has(code)) return code;
  return 'generic';
}
