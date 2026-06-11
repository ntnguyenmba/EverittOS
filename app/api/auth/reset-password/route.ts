import { mapAuthError } from '@/lib/auth-errors';
import { logAuthEvent } from '@/lib/auth-logger';
import { appUrl } from '@/lib/app-url';
import { checkSupabaseConnectivity } from '@/lib/supabase-connectivity';
import { isSupabaseConfigured, supabaseConfigDiagnostics } from '@/lib/supabase-config';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const diagnostics = supabaseConfigDiagnostics();

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

  const email = (body.email || '').trim().toLowerCase();
  if (!email) {
    const { json } = await createRouteHandlerSupabase();
    return json({ error: 'Email is required.', code: 'validation' }, { status: 400 });
  }

  const { supabase, json } = await createRouteHandlerSupabase();
  const redirectTo = appUrl('/auth/callback?next=/reset-password&type=recovery');

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    logAuthEvent('reset_password_failed', { reason: error.message, host: diagnostics.urlHost || 'unknown' });
    const mapped = mapAuthError(error.message);
    return json(
      {
        error: mapped.message,
        title: mapped.title,
        code: error.message,
        supabaseMessage: error.message,
        diagnostics,
        connectivity
      },
      { status: 400 }
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
