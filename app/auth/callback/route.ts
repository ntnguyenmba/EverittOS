import { NextResponse } from 'next/server';
import { mapAuthError } from '@/lib/auth-errors';
import { logAuthEvent } from '@/lib/auth-logger';
import { safeNextPath } from '@/lib/app-url';
import { PRIVACY_VERSION, TERMS_VERSION } from '@/lib/legal-versions';
import { ensureUserWorkspace } from '@/lib/profile-bootstrap-server';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';

export const runtime = 'nodejs';

function authRedirectUrl(
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

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'), '/onboarding');
  const authError = searchParams.get('error_description') || searchParams.get('error');
  const flowType = searchParams.get('type');
  const isRecovery = flowType === 'recovery' || next === '/reset-password';

  if (authError) {
    const decoded = decodeURIComponent(authError);
    logAuthEvent('auth_callback_error', { reason: decoded, flowType: flowType || 'unknown' });
    const mapped = mapAuthError(decoded);
    const login = authRedirectUrl(origin, isRecovery ? '/forgot-password' : '/login', {
      error: mapped.message,
      error_code: mapped.code || decoded,
      reason: isRecovery ? 'reset' : 'auth'
    });
    return NextResponse.redirect(login);
  }

  if (!code) {
    logAuthEvent('auth_callback_missing_code', { next });
    const mapped = mapAuthError('missing_auth_code', 'missing_auth_code');
    const login = authRedirectUrl(origin, '/login', {
      error: mapped.message,
      error_code: mapped.code || 'missing_auth_code',
      reason: 'auth'
    });
    return NextResponse.redirect(login);
  }

  const { supabase, redirect } = await createRouteHandlerSupabase();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    logAuthEvent('auth_callback_exchange_failed', {
      reason: exchangeError.message,
      flowType: flowType || 'unknown'
    });
    const mapped = mapAuthError(exchangeError.message, isRecovery ? 'reset_link_expired' : 'pkce_flow_expired');
    const target = isRecovery ? '/forgot-password' : '/login';
    const page = authRedirectUrl(origin, target, {
      error: mapped.message,
      error_code: mapped.code || exchangeError.message,
      reason: isRecovery ? 'reset' : 'auth'
    });
    return NextResponse.redirect(page);
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    logAuthEvent('auth_callback_no_user', { flowType: flowType || 'unknown' });
    const login = authRedirectUrl(origin, '/login', {
      error: 'Email confirmation succeeded but no session was created. Sign in with your email and password.',
      error_code: 'session_missing',
      reason: 'auth'
    });
    return NextResponse.redirect(login);
  }

  if (isRecovery) {
    return redirect(new URL('/reset-password', origin), { establishSession: true });
  }

  const bootstrap = await ensureUserWorkspace(user.id, user.email || '', user.user_metadata || undefined, supabase);

  if (!bootstrap.ok) {
    logAuthEvent('auth_callback_bootstrap_failed', {
      userId: user.id,
      code: bootstrap.code,
      reason: bootstrap.details || bootstrap.message
    });
    await supabase.auth.signOut();
    const login = authRedirectUrl(origin, '/login', {
      error: bootstrap.message,
      error_code: bootstrap.code,
      reason: 'profile_setup',
      detail: bootstrap.details
    });
    return redirect(login);
  }

  const isSignupFlow = flowType === 'signup' || flowType === 'email' || next.includes('onboarding');

  if (isSignupFlow) {
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
      logAuthEvent('auth_callback_consent_failed', { userId: user.id, reason: consentError.message });
    }
  }

  logAuthEvent('auth_callback_success', {
    userId: user.id,
    flowType: flowType || 'unknown',
    next,
    bootstrapped: bootstrap.created ? 1 : 0
  });

  const destination = new URL(next, origin);
  if (isSignupFlow) {
    destination.searchParams.set('verified', '1');
  }

  return redirect(destination, { establishSession: true });
}
