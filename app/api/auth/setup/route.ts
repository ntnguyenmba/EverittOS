import { logAuthEvent } from '@/lib/auth-logger';
import { ensureUserWorkspace, isRetryableBootstrapCode } from '@/lib/profile-bootstrap-server';
import { sanitizeErrorPayload, safeErrorMessage } from '@/lib/safe-api-error';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';

export const runtime = 'nodejs';

/** Repair profile + organization access for the current session (e.g. legacy auth users). */
export async function POST() {
  try {
    const { supabase, json } = await createRouteHandlerSupabase();

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return json({ error: 'Sign in required.', code: 'unauthorized' }, { status: 401 });
    }

    let bootstrap = await ensureUserWorkspace(
      user.id,
      user.email || '',
      user.user_metadata || undefined,
      supabase
    );

    if (!bootstrap.ok && isRetryableBootstrapCode(bootstrap.code)) {
      logAuthEvent('workspace_bootstrap_retry', { userId: user.id, code: bootstrap.code, route: 'setup' });
      bootstrap = await ensureUserWorkspace(
        user.id,
        user.email || '',
        user.user_metadata || undefined,
        supabase
      );
    }

    if (!bootstrap.ok) {
      logAuthEvent('workspace_bootstrap_failed', {
        userId: user.id,
        code: bootstrap.code,
        route: 'setup',
        reason: bootstrap.details || bootstrap.message
      });
      return json(
        sanitizeErrorPayload({
          error: bootstrap.message,
          title: 'Workspace setup required',
          code: bootstrap.code,
          setupRequired: isRetryableBootstrapCode(bootstrap.code),
          retryable: isRetryableBootstrapCode(bootstrap.code)
        }),
        { status: bootstrap.code === 'bootstrap_unavailable' ? 503 : 409 }
      );
    }

    return json({
      ok: true,
      profile: bootstrap.profile,
      created: bootstrap.created,
      redirectTo: '/dashboard'
    });
  } catch (err) {
    const { json } = await createRouteHandlerSupabase();
    return json(
      sanitizeErrorPayload({
        error: 'Workspace setup failed due to a server error.',
        details: safeErrorMessage(err, 'Workspace setup failed due to a server error.'),
        code: 'setup_route_exception'
      }),
      { status: 500 }
    );
  }
}
