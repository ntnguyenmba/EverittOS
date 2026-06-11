import { isAccountActive } from '@/lib/account-status';
import { logAuthEvent } from '@/lib/auth-logger';
import { mapAuthError } from '@/lib/auth-errors';
import { defaultPathForRole } from '@/lib/role-routes';
import { ensureUserWorkspace } from '@/lib/profile-bootstrap-server';
import { checkSupabaseConnectivity } from '@/lib/supabase-connectivity';
import { isSupabaseConfigured, supabaseConfigDiagnostics } from '@/lib/supabase-config';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';

export const runtime = 'nodejs';

function loginDiagnostics(input: {
  userId?: string;
  profile?: {
    role?: string | null;
    organization_id?: string | null;
    account_status?: string | null;
  } | null;
  hasMembership?: boolean;
  sessionVerified?: boolean;
}) {
  return {
    session: {
      verified: Boolean(input.sessionVerified),
      userId: input.userId || null
    },
    profile: {
      present: Boolean(input.profile),
      role: input.profile?.role ?? null,
      organizationId: input.profile?.organization_id ?? null,
      accountStatus: input.profile?.account_status ?? null
    },
    organization: {
      present: Boolean(input.profile?.organization_id || input.hasMembership),
      membershipActive: input.hasMembership ?? false
    }
  };
}

export async function POST(request: Request) {
  const configDiagnostics = supabaseConfigDiagnostics();

  try {
    logAuthEvent('login_route_start', {
      configured: configDiagnostics.configured ? 1 : 0,
      host: configDiagnostics.urlHost || 'missing',
      serviceRole: configDiagnostics.serviceRolePresent ? 1 : 0
    });

    if (!isSupabaseConfigured()) {
      logAuthEvent('login_config_missing', { host: configDiagnostics.urlHost || 'missing' });
      const mapped = mapAuthError('config_error', 'config_error');
      const { json } = await createRouteHandlerSupabase();
      return json(
        {
          error: mapped.message,
          title: mapped.title,
          details: mapped.details,
          code: 'config_error',
          diagnostics: loginDiagnostics({ sessionVerified: false }),
          config: configDiagnostics
        },
        { status: 503 }
      );
    }

    const connectivity = await checkSupabaseConnectivity();
    if (!connectivity.ok) {
      const { json } = await createRouteHandlerSupabase();
      return json(
        {
          error: 'This deployment cannot reach Supabase. Verify NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel, then redeploy.',
          title: 'Supabase unreachable',
          details: connectivity.error,
          code: 'supabase_unreachable',
          supabaseMessage: connectivity.error,
          diagnostics: loginDiagnostics({ sessionVerified: false }),
          config: configDiagnostics,
          connectivity
        },
        { status: 503 }
      );
    }

    let body: { email?: string; password?: string; next?: string };
    try {
      body = await request.json();
    } catch {
      const { json } = await createRouteHandlerSupabase();
      return json({ error: 'Invalid request body.', code: 'bad_request' }, { status: 400 });
    }

    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const next = body.next;

    if (!email || !password) {
      const { json } = await createRouteHandlerSupabase();
      return json({ error: 'Email and password are required.', code: 'validation' }, { status: 400 });
    }

    const { supabase, json } = await createRouteHandlerSupabase();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const isFetchFailure = error.message.toLowerCase().includes('fetch failed');
      logAuthEvent('login_failed', {
        emailDomain: email.split('@')[1] || 'unknown',
        reason: error.message,
        host: configDiagnostics.urlHost || 'unknown',
        fetchFailure: isFetchFailure ? 1 : 0
      });

      const mapped = mapAuthError(error.message);
      return json(
        {
          error: isFetchFailure
            ? 'Supabase auth request failed from the server. Verify Supabase URL/key in Vercel and that the project is active.'
            : mapped.message,
          title: isFetchFailure ? 'Supabase connection failed' : mapped.title,
          details: isFetchFailure
            ? `${error.message}. Host: ${configDiagnostics.urlHost || 'unknown'}. Connectivity: ${connectivity.latencyMs}ms.`
            : mapped.details,
          code: error.message,
          supabaseMessage: error.message,
          diagnostics: loginDiagnostics({ sessionVerified: false }),
          config: configDiagnostics,
          connectivity
        },
        { status: isFetchFailure ? 503 : 401 }
      );
    }

    const user = data.user;
    if (!user) {
      return json(
        {
          error: 'Sign in did not return a user session.',
          title: 'Session missing',
          code: 'no_user',
          diagnostics: loginDiagnostics({ sessionVerified: false }),
          config: configDiagnostics,
          connectivity
        },
        { status: 500 }
      );
    }

    const {
      data: { user: verifiedUser },
      error: verifyError
    } = await supabase.auth.getUser();

    if (verifyError || !verifiedUser) {
      logAuthEvent('session_verify_failed', { userId: user.id, reason: verifyError?.message || 'no user' });
      return json(
        {
          error: 'Supabase accepted your credentials but the session cookie was not saved. Try again or contact support.',
          title: 'Session not persisted',
          details: verifyError?.message || 'getUser() returned no session after signInWithPassword.',
          code: 'session_not_persisted',
          supabaseMessage: verifyError?.message,
          diagnostics: loginDiagnostics({ userId: user.id, sessionVerified: false }),
          config: configDiagnostics,
          connectivity
        },
        { status: 500 }
      );
    }

    const bootstrap = await ensureUserWorkspace(user.id, email, user.user_metadata || undefined);

    if (!bootstrap.ok) {
      await supabase.auth.signOut();
      return json(
        {
          error: bootstrap.message,
          title: 'Workspace setup required',
          details: bootstrap.details,
          code: bootstrap.code,
          setupRequired: true,
          diagnostics: loginDiagnostics({
            userId: user.id,
            sessionVerified: true,
            profile: bootstrap.profileSnapshot ?? null,
            hasMembership: bootstrap.hasMembership
          }),
          config: configDiagnostics,
          connectivity
        },
        { status: 409 }
      );
    }

    const profile = bootstrap.profile;

    if (!isAccountActive(profile.account_status)) {
      await supabase.auth.signOut();
      logAuthEvent('login_blocked_disabled', { userId: user.id });
      const mapped = mapAuthError('account_disabled', 'account_disabled');
      return json(
        {
          error: mapped.message,
          title: mapped.title,
          details: mapped.details,
          code: 'account_disabled',
          diagnostics: loginDiagnostics({
            userId: user.id,
            sessionVerified: true,
            profile,
            hasMembership: true
          }),
          config: configDiagnostics,
          connectivity
        },
        { status: 403 }
      );
    }

    let redirectTo = defaultPathForRole(profile.role, next);
    if (bootstrap.created && redirectTo === '/dashboard') {
      redirectTo = '/onboarding?setup=1';
    }

    logAuthEvent('login_success', {
      userId: user.id,
      role: profile.role,
      bootstrapped: bootstrap.created ? 1 : 0,
      host: configDiagnostics.urlHost || 'unknown'
    });

    return json({
      ok: true,
      redirectTo,
      role: profile.role,
      plan: profile.plan,
      subscriptionStatus: profile.subscription_status,
      workspaceCreated: bootstrap.created,
      diagnostics: loginDiagnostics({
        userId: verifiedUser.id,
        sessionVerified: true,
        profile,
        hasMembership: Boolean(profile.organization_id)
      }),
      config: configDiagnostics,
      connectivity
    });
  } catch (err) {
    logAuthEvent('login_route_exception', { reason: err instanceof Error ? err.message : String(err) });
    const { json } = await createRouteHandlerSupabase();
    return json(
      {
        error: 'Sign-in failed due to a server error.',
        title: 'Server error',
        details: err instanceof Error ? err.message : String(err),
        code: 'login_route_exception',
        diagnostics: loginDiagnostics({ sessionVerified: false }),
        config: configDiagnostics
      },
      { status: 500 }
    );
  }
}
