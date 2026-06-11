const ALWAYS_LOG = new Set([
  'auth_step',
  'login_config_missing',
  'login_failed',
  'login_route_exception',
  'supabase_connectivity_failed',
  'supabase_admin_unconfigured',
  'reset_password_failed',
  'session_verify_failed',
  'profile_read_session_failed',
  'profile_read_failed'
]);

/** Console-safe auth logging. Never log passwords, tokens, or keys. */
export function logAuthEvent(event: string, meta?: Record<string, string | number | boolean | null | undefined>) {
  const shouldLog = ALWAYS_LOG.has(event) || process.env.AUTH_DEBUG === '1' || process.env.NODE_ENV !== 'production';
  if (!shouldLog) return;

  const safe: Record<string, string | number | boolean> = { event };
  if (meta) {
    for (const [key, value] of Object.entries(meta)) {
      if (value === undefined || value === null) continue;
      const lower = key.toLowerCase();
      if (
        lower.includes('password') ||
        (lower.includes('token') && !lower.includes('host')) ||
        lower.includes('secret') ||
        lower.includes('anonkey') ||
        lower.includes('service_role')
      ) {
        continue;
      }
      safe[key] = typeof value === 'object' ? JSON.stringify(value) : value;
    }
  }

  const line = `[everittos-auth] ${JSON.stringify(safe)}`;
  if (ALWAYS_LOG.has(event)) {
    console.error(line);
  } else {
    console.info(line);
  }
}
