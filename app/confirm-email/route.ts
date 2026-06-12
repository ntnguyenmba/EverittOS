import { logAuthDebug } from '@/lib/auth-debug';
import { mapAuthError } from '@/lib/auth-errors';
import { logAuthEvent } from '@/lib/auth-logger';
import { safeNextPath } from '@/lib/app-url';
import { PRIVACY_VERSION, TERMS_VERSION } from '@/lib/legal-versions';
import { ensureUserWorkspace } from '@/lib/profile-bootstrap-server';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';

export const runtime = 'nodejs';

function redirectWithParams(
  origin: string,
  path: string,
  params: Record<string, string | undefined>
): URL {
  const url = new URL(path, origin);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url;
}

/** Handles Supabase signup confirmation links (emailRedirectTo). */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'), '/onboarding');
  logAuthDebug('confirm_email_callback', { next, hasCode: code ? 1 : 0 });
  const authError = searchParams.get('error_description') || searchParams.get('error');

  if (authError) {
    const decoded = decodeURIComponent(authError);
    logAuthEvent('confirm_email_error', { reason: decoded });
    const mapped = mapAuthError(decoded, 'pkce_flow_expired');
    return Response.redirect(
      redirectWithParams(origin, '/signup', {
        error: mapped.message,
        error_code: mapped.code || decoded,
        reason: 'auth'
      })
    );
  }

  if (!code) {
    logAuthEvent('confirm_email_missing_code', { next });
    const mapped = mapAuthError('missing_auth_code', 'missing_auth_code');
    return Response.redirect(
      redirectWithParams(origin, '/signup', {
        error: mapped.message,
        error_code: mapped.code || 'missing_auth_code',
        reason: 'auth'
      })
    );
  }

  const { supabase, redirect } = await createRouteHandlerSupabase();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    logAuthEvent('confirm_email_exchange_failed', { reason: exchangeError.message });
    const mapped = mapAuthError(exchangeError.message, 'pkce_flow_expired');
    return redirect(
      redirectWithParams(origin, '/signup', {
        error: mapped.message,
        error_code: mapped.code || exchangeError.message,
        reason: 'auth'
      })
    );
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    logAuthEvent('confirm_email_no_user', {});
    return redirect(
      redirectWithParams(origin, '/login', {
        error: 'Email confirmation succeeded but no session was created. Sign in with your email and password.',
        error_code: 'session_missing',
        reason: 'auth'
      })
    );
  }

  const bootstrap = await ensureUserWorkspace(user.id, user.email || '', user.user_metadata || undefined, supabase);

  if (!bootstrap.ok) {
    logAuthEvent('confirm_email_bootstrap_failed', {
      userId: user.id,
      code: bootstrap.code,
      reason: bootstrap.details || bootstrap.message
    });
    await supabase.auth.signOut();
    return redirect(
      redirectWithParams(origin, '/login', {
        error: bootstrap.message,
        error_code: bootstrap.code,
        reason: 'profile_setup',
        detail: bootstrap.details
      })
    );
  }

  const now = new Date().toISOString();
  const { error: consentError } = await supabase
    .from('profiles')
    .update({
      terms_accepted_at: now,
      privacy_accepted_at: now,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION
    })
    .eq('id', user.id);

  if (consentError) {
    logAuthEvent('confirm_email_consent_failed', { userId: user.id, reason: consentError.message });
  }

  await supabase.auth.signOut();

  logAuthEvent('confirm_email_success', {
    userId: user.id,
    next,
    bootstrapped: bootstrap.created ? 1 : 0
  });

  return redirect(
    redirectWithParams(origin, '/login', {
      verified: '1',
      next
    })
  );
}
