import { mapAuthError } from '@/lib/auth-errors';
import { logAuthEvent } from '@/lib/auth-logger';
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

/** Exchanges a Supabase recovery code and redirects to /reset-password with session cookies. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const authError = searchParams.get('error_description') || searchParams.get('error');

  if (authError) {
    const decoded = decodeURIComponent(authError);
    logAuthEvent('reset_password_link_error', { reason: decoded });
    const mapped = mapAuthError(decoded, 'reset_link_expired');
    return Response.redirect(
      redirectWithParams(origin, '/forgot-password', {
        error: mapped.message,
        error_code: mapped.code || decoded,
        reason: 'reset'
      })
    );
  }

  if (!code) {
    logAuthEvent('reset_password_link_missing_code', {});
    const mapped = mapAuthError('reset_link_expired', 'reset_link_expired');
    return Response.redirect(
      redirectWithParams(origin, '/forgot-password', {
        error: mapped.message,
        error_code: mapped.code || 'missing_auth_code',
        reason: 'reset'
      })
    );
  }

  const { supabase, redirect } = await createRouteHandlerSupabase();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    logAuthEvent('reset_password_link_exchange_failed', { reason: exchangeError.message });
    const mapped = mapAuthError(exchangeError.message, 'reset_link_expired');
    return redirect(
      redirectWithParams(origin, '/forgot-password', {
        error: mapped.message,
        error_code: mapped.code || exchangeError.message,
        reason: 'reset'
      })
    );
  }

  logAuthEvent('reset_password_link_success', {});

  return redirect(new URL('/reset-password', origin), { establishSession: true });
}
