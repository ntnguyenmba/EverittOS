import { isSupabaseConfigured } from '@/lib/supabase-config';

export type EnvValidationIssue = {
  level: 'error' | 'warn' | 'info';
  key: string;
  message: string;
};

export type EnvValidationResult = {
  ok: boolean;
  issues: EnvValidationIssue[];
};

function hasValue(key: string): boolean {
  return Boolean((process.env[key] || '').trim());
}

/** Validate environment variables at server startup. Never throws; logs issues instead. */
export function validateEnvAtStartup(): EnvValidationResult {
  const issues: EnvValidationIssue[] = [];

  if (!hasValue('NEXT_PUBLIC_SUPABASE_URL')) {
    issues.push({
      level: 'error',
      key: 'NEXT_PUBLIC_SUPABASE_URL',
      message: 'Missing Supabase project URL. Authentication will not work until this is set.'
    });
  }

  if (!hasValue('NEXT_PUBLIC_SUPABASE_ANON_KEY') && !hasValue('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')) {
    issues.push({
      level: 'error',
      key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      message: 'Missing Supabase anon key. Authentication will not work until this is set.'
    });
  }

  if (!isSupabaseConfigured()) {
    issues.push({
      level: 'warn',
      key: 'SUPABASE_CONFIG',
      message: 'Supabase credentials are missing or using build placeholders. Auth routes will return 503.'
    });
  }

  if (!hasValue('NEXT_PUBLIC_APP_URL')) {
    issues.push({
      level: 'warn',
      key: 'NEXT_PUBLIC_APP_URL',
      message: 'Missing app URL. Password reset and email redirect links may be incorrect.'
    });
  }

  if (!hasValue('SUPABASE_SERVICE_ROLE_KEY')) {
    issues.push({
      level: 'warn',
      key: 'SUPABASE_SERVICE_ROLE_KEY',
      message: 'Missing service role key. Workspace bootstrap and admin APIs may fail.'
    });
  }

  if (!hasValue('STRIPE_SECRET_KEY')) {
    issues.push({
      level: 'info',
      key: 'STRIPE_SECRET_KEY',
      message: 'Stripe secret key not set. Billing webhooks and portal will be unavailable.'
    });
  }

  if (!hasValue('STRIPE_WEBHOOK_SECRET')) {
    issues.push({
      level: 'info',
      key: 'STRIPE_WEBHOOK_SECRET',
      message: 'Stripe webhook secret not set. Subscription sync will not run.'
    });
  }

  if (!hasValue('RESEND_API_KEY') || !hasValue('EMAIL_FROM')) {
    issues.push({
      level: 'info',
      key: 'RESEND_API_KEY',
      message: 'Transactional email not fully configured. Invite emails will use copy-link fallback.'
    });
  }

  const googleClientId = hasValue('GOOGLE_CLIENT_ID') || hasValue('GOOGLE_CALENDAR_CLIENT_ID');
  const googleClientSecret = hasValue('GOOGLE_CLIENT_SECRET') || hasValue('GOOGLE_CALENDAR_CLIENT_SECRET');
  if (!googleClientId || !googleClientSecret) {
    issues.push({
      level: 'info',
      key: 'GOOGLE_CLIENT_ID',
      message: 'Google Calendar OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.'
    });
  }

  const errors = issues.filter((i) => i.level === 'error');
  const result: EnvValidationResult = { ok: errors.length === 0, issues };

  const prefix = '[EverittOS env]';
  for (const issue of issues) {
    const line = `${prefix} ${issue.level.toUpperCase()} ${issue.key}: ${issue.message}`;
    if (issue.level === 'error') console.error(line);
    else if (issue.level === 'warn') console.warn(line);
    else console.info(line);
  }

  return result;
}
