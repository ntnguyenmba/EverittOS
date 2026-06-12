import { mapAuthError } from '@/lib/auth-errors';
import { logAuthEvent } from '@/lib/auth-logger';
import { logAuthStep } from '@/lib/auth-diagnostics';
import { authRoutes } from '@/lib/app-url';
import { logAuthDebug } from '@/lib/auth-debug';
import { validatePasswordLength } from '@/lib/input-validation';
import { sanitizeAuthErrorPayload, safeErrorMessage } from '@/lib/safe-api-error';
import { checkSupabaseConnectivity } from '@/lib/supabase-connectivity';
import { isSupabaseConfigured, supabaseConfigDiagnostics } from '@/lib/supabase-config';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';

export const runtime = 'nodejs';

const ROUTE = 'update_password';

function secureUpdatePayload(body: Record<string, unknown>): Record<string, unknown> {
  return sanitizeAuthErrorPayload(body);
}

export async function POST(request: Request) {
  const diagnostics = supabaseConfigDiagnostics();

  try {
    logAuthStep(ROUTE, 'config_check', {
      configured: diagnostics.configured ? 1 : 0,
      host: diagnostics.urlHost || 'missing'
    });

    if (!isSupabaseConfigured()) {
      const { json } = await createRouteHandlerSupabase();
      return json(
        secureUpdatePayload({
          error: 'Authentication is not configured on the server.',
          title: 'Configuration required',
          code: 'config_error',
          diagnostics
        }),
        { status: 503 }
      );
    }

    logAuthStep(ROUTE, 'connectivity', { host: diagnostics.urlHost || 'unknown' });
    const connectivity = await checkSupabaseConnectivity();
    if (!connectivity.ok) {
      const { json } = await createRouteHandlerSupabase();
      return json(
        secureUpdatePayload({
          error: 'Cannot reach Supabase from this deployment.',
          title: 'Supabase unreachable',
          code: 'supabase_unreachable',
          supabaseMessage: connectivity.error,
          diagnostics,
          connectivity
        }),
        { status: 503 }
      );
    }

    let body: { password?: string };
    try {
      body = await request.json();
    } catch {
      const { json } = await createRouteHandlerSupabase();
      return json({ error: 'Invalid request body.', code: 'bad_request' }, { status: 400 });
    }

    const password = body.password || '';
    if (!validatePasswordLength(password)) {
      const { json } = await createRouteHandlerSupabase();
      return json(
        { error: 'Password must be between 6 and 128 characters.', code: 'validation' },
        { status: 400 }
      );
    }

    const { supabase, json } = await createRouteHandlerSupabase();

    logAuthStep(ROUTE, 'session_verify');
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      logAuthEvent('update_password_no_session', { reason: userError?.message || 'no user' });
      const mapped = mapAuthError('reset_link_expired', 'reset_link_expired');
      return json(
        secureUpdatePayload({
          error: mapped.message,
          title: mapped.title,
          code: 'session_missing',
          supabaseMessage: userError?.message || 'No active recovery session.',
          diagnostics,
          connectivity
        }),
        { status: 401 }
      );
    }

    logAuthStep(ROUTE, 'sign_in', { userId: user.id });
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      logAuthEvent('update_password_failed', { userId: user.id, reason: updateError.message });
      const mapped = mapAuthError(updateError.message);
      return json(
        secureUpdatePayload({
          error: mapped.message,
          title: mapped.title,
          code: mapped.code || updateError.message,
          supabaseMessage: updateError.message,
          diagnostics,
          connectivity
        }),
        { status: 400 }
      );
    }

    await supabase.auth.signOut();

    const redirectTo = `${authRoutes.login()}?reset=1`;
    logAuthDebug('update_password_redirect', { redirectTo });
    logAuthEvent('update_password_success', { userId: user.id, host: diagnostics.urlHost || 'unknown' });

    return json(
      secureUpdatePayload({
        ok: true,
        message: 'Password updated. Sign in with your new password.',
        redirectTo,
        diagnostics,
        connectivity
      })
    );
  } catch (err) {
    logAuthEvent('update_password_route_exception', {
      reason: err instanceof Error ? err.message : String(err)
    });
    const { json } = await createRouteHandlerSupabase();
    return json(
      secureUpdatePayload({
        error: safeErrorMessage(err, 'Password update failed due to a server error.'),
        title: 'Server error',
        code: 'update_password_route_exception',
        supabaseMessage: err instanceof Error ? err.message : String(err),
        diagnostics
      }),
      { status: 500 }
    );
  }
}
