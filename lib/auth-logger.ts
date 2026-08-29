const ALWAYS_LOG = new Set([
  'auth_step',
  'auth_callback_error',
  'auth_callback_missing_code',
  'auth_callback_exchange_failed',
  'auth_callback_no_user',
  'auth_callback_bootstrap_failed',
  'auth_callback_consent_failed',
  'auth_callback_success',
  'confirm_email_error',
  'confirm_email_missing_code',
  'confirm_email_exchange_failed',
  'confirm_email_no_user',
  'confirm_email_bootstrap_failed',
  'confirm_email_consent_failed',
  'confirm_email_success',
  'reset_password_link_error',
  'reset_password_link_missing_code',
  'reset_password_link_exchange_failed',
  'reset_password_link_success',
  'login_config_missing',
  'login_failed',
  'login_failure_diagnosis',
  'login_route_exception',
  'signup_failed',
  'signup_success',
  'signup_attempt',
  'signup_existing_user',
  'signup_confirmation_resent',
  'signup_route_exception',
  'profile_created',
  'workspace_created',
  'onboarding_completed',
  'update_password_failed',
  'update_password_no_session',
  'update_password_route_exception',
  'update_password_success',
  'supabase_connectivity_failed',
  'supabase_admin_unconfigured',
  'reset_password_failed',
  'session_verify_failed',
  'profile_read_session_failed',
  'profile_read_failed',
  'profile_bootstrap_failed',
  'org_bootstrap_failed',
  'membership_bootstrap_failed',
  'org_settings_bootstrap_failed',
  'bootstrap_step_ok',
  'bootstrap_step_failed',
  'workspace_bootstrap_retry',
  'workspace_bootstrap_failed',
  'google_calendar_callback',
  'google_calendar_status',
  'google_calendar_disconnect',
  'google_calendar_token_refresh',
  'job_create_failed',
  'job_create_succeeded',
  'job_list_failed'
]);

const ERROR_EVENTS = new Set([
  'auth_callback_error',
  'auth_callback_missing_code',
  'auth_callback_exchange_failed',
  'auth_callback_no_user',
  'auth_callback_bootstrap_failed',
  'auth_callback_consent_failed',
  'confirm_email_error',
  'confirm_email_missing_code',
  'confirm_email_exchange_failed',
  'confirm_email_no_user',
  'confirm_email_bootstrap_failed',
  'confirm_email_consent_failed',
  'reset_password_link_error',
  'reset_password_link_missing_code',
  'reset_password_link_exchange_failed',
  'login_config_missing',
  'login_failed',
  'login_failure_diagnosis',
  'login_route_exception',
  'signup_failed',
  'signup_route_exception',
  'update_password_failed',
  'update_password_no_session',
  'update_password_route_exception',
  'supabase_connectivity_failed',
  'supabase_admin_unconfigured',
  'reset_password_failed',
  'session_verify_failed',
  'profile_read_session_failed',
  'profile_read_failed',
  'profile_bootstrap_failed',
  'org_bootstrap_failed',
  'membership_bootstrap_failed',
  'org_settings_bootstrap_failed',
  'bootstrap_step_failed',
  'workspace_bootstrap_failed',
  'job_create_failed',
  'job_list_failed'
]);

/** Console-safe auth logging. Critical events always log; only failures use the error stream. */
export function logAuthEvent(event: string, meta?: Record<string, string | number | boolean | null | undefined>) {
  const alwaysLog = ALWAYS_LOG.has(event);
  const shouldLog = alwaysLog || (process.env.NODE_ENV !== 'production' && process.env.AUTH_DEBUG === '1');
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
  if (ERROR_EVENTS.has(event)) {
    console.error(line);
  } else {
    console.info(line);
  }
}
