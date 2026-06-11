import { mapAuthError } from '@/lib/auth-errors';
import { isValidEmail, normalizeEmail } from '@/lib/input-validation';
import { sanitizeErrorPayload, safeErrorMessage } from '@/lib/safe-api-error';
import { logAuthEvent } from '@/lib/auth-logger';
import { logAuthStep } from '@/lib/auth-diagnostics';
import { appUrl } from '@/lib/app-url';
import { checkSupabaseConnectivity } from '@/lib/supabase-connectivity';
import { isSupabaseConfigured, supabaseConfigDiagnostics } from '@/lib/supabase-config';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';

export const runtime = 'nodejs';

const ROUTE = 'reset_password';

export async function POST(request: Request) {
  const diagnostics = supabaseConfigDiagnostics();

  logAuthStep(ROUTE, 'config_check', {
    configured: diagnostics.configured ? 1 : 0,
    host: diagnostics.urlHost || 'missing'
  });

  if (!isSupabaseConfigured()) {
    const { json } = await createRouteHandlerSupabase();
    return json(
      {
        error: 'Authentication is not configured on the server.',
        title: 'Configuration required',
        code: 'config_error',
        diagnostics
      },
      { status: 503 }
    );
  }

  logAuthStep(ROUTE, 'connectivity', { host: diagnostics.urlHost || 'unknown' });
  const connectivity = await checkSupabaseConnectivity();
  if (!connectivity.ok) {
    const { json } = await createRouteHandlerSupabase();
    return json(
      {
        error: 'Cannot reach Supabase from this deployment. Check NEXT_PUBLIC_SUPABASE_URL and redeploy.',
        title: 'Supabase unreachable',
        code: 'supabase_unreachable',
        supabaseMessage: connectivity.error,
        diagnostics,
        connectivity
      },
      { status: 503 }
    );
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    const { json } = await createRouteHandlerSupabase();
    return json({ error: 'Invalid request body.', code: 'bad_request' }, { status: 400 });
  }

  const email = normalizeEmail(body.email || '');
  if (!email) {
    const { json } = await createRouteHandlerSupabase();
    return json({ error: 'Email is required.', code: 'validation' }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    const { json } = await createRouteHandlerSupabase();
    return json({ error: 'Enter a valid email address.', code: 'validation' }, { status: 400 });
  }

  const { supabase, json } = await createRouteHandlerSupabase();
  const redirectTo = appUrl('/auth/callback?next=/reset-password&type=recovery');

  logAuthStep(ROUTE, 'sign_in', { host: diagnostics.urlHost || 'unknown', redirectHost: new URL(redirectTo).host });
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    const isFetchFailure = error.message.toLowerCase().includes('fetch failed');
    logAuthEvent('reset_password_failed', { reason: error.message, host: diagnostics.urlHost || 'unknown' });
    const mapped = mapAuthError(error.message);
    return json(
      {
        error: isFetchFailure
          ? 'Supabase password reset request failed from the server. Verify Supabase URL/key in Vercel.'
          : mapped.message,
        title: isFetchFailure ? 'Supabase connection failed' : mapped.title,
        code: error.message,
        supabaseMessage: error.message,
        diagnostics,
        connectivity
      },
      { status: isFetchFailure ? 503 : 400 }
    );
  }

  logAuthEvent('reset_password_sent', { host: diagnostics.urlHost || 'unknown' });

  return json({
    ok: true,
    message: 'If an account exists for that email, a reset link is on its way.',
    diagnostics,
    connectivity
  });
}
