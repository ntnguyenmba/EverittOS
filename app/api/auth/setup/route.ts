import { NextResponse } from 'next/server';
import { ensureUserWorkspace } from '@/lib/profile-bootstrap-server';
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

    const bootstrap = await ensureUserWorkspace(user.id, user.email || '', user.user_metadata || undefined);

    if (!bootstrap.ok) {
      return json(
        {
          error: bootstrap.message,
          title: 'Workspace setup required',
          details: bootstrap.details,
          code: bootstrap.code,
          setupRequired: true,
          diagnostics: {
            profile: bootstrap.profileSnapshot ?? null,
            hasMembership: bootstrap.hasMembership ?? false
          }
        },
        { status: 409 }
      );
    }

    return json({
      ok: true,
      profile: bootstrap.profile,
      created: bootstrap.created,
      redirectTo: bootstrap.created ? '/onboarding?setup=1' : '/dashboard'
    });
  } catch (err) {
    const { json } = await createRouteHandlerSupabase();
    return json(
      {
        error: 'Workspace setup failed due to a server error.',
        details: err instanceof Error ? err.message : String(err),
        code: 'setup_route_exception'
      },
      { status: 500 }
    );
  }
}
