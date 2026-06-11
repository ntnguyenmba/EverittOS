import { isAccountActive } from '@/lib/account-status';
import { logSecurityEvent, requestClientMeta } from '@/lib/security-events';
import { logActivityServer } from '@/lib/activity-server';
import { logAuthEvent } from '@/lib/auth-logger';
import { logAuthStep, workspaceDiagnostics } from '@/lib/auth-diagnostics';
import { mapAuthError } from '@/lib/auth-errors';
import { isValidEmail, normalizeEmail, validatePasswordLength } from '@/lib/input-validation';
import { sanitizeErrorPayload, safeErrorMessage } from '@/lib/safe-api-error';
import { postAuthRedirectPath } from '@/lib/post-auth-redirect';
import { ensureUserWorkspace } from '@/lib/profile-bootstrap-server';
import { checkSupabaseConnectivity } from '@/lib/supabase-connectivity';
import { isSupabaseConfigured, supabaseConfigDiagnostics } from '@/lib/supabase-config';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';

export const runtime = 'nodejs';

const ROUTE = 'login';

function secureLoginPayload(body: Record<string, unknown>): Record<string, unknown> {
  return sanitizeErrorPayload(body);
}

export async function POST(request: Request) {
  const configDiagnostics = supabaseConfigDiagnostics();

  try {
    logAuthStep(ROUTE, 'config_check', {
      configured: configDiagnostics.configured ? 1 : 0,
      host: configDiagnostics.urlHost || 'missing',
      serviceRole: configDiagnostics.serviceRolePresent ? 1 : 0
    });

    if (!isSupabaseConfigured()) {
      logAuthEvent('login_config_missing', { host: configDiagnostics.urlHost || 'missing' });
      const mapped = mapAuthError('config_error', 'config_error');
      const { json } = await createRouteHandlerSupabase();
      return json(
        secureLoginPayload({
          error: mapped.message,
          title: mapped.title,
          details: mapped.details,
          code: 'config_error',
          diagnostics: workspaceDiagnostics({ authStep: 'config_check', sessionVerified: false }),
          config: configDiagnostics
        }),
        { status: 503 }
      );
    }

    logAuthStep(ROUTE, 'connectivity', { host: configDiagnostics.urlHost || 'unknown' });
    const connectivity = await checkSupabaseConnectivity();
    if (!connectivity.ok) {
      const { json } = await createRouteHandlerSupabase();
      return json(
        secureLoginPayload({
          error: 'This deployment cannot reach Supabase. Verify NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel, then redeploy.',
          title: 'Supabase unreachable',
          details: connectivity.error,
          code: 'supabase_unreachable',
          supabaseMessage: connectivity.error,
          diagnostics: workspaceDiagnostics({ authStep: 'connectivity', sessionVerified: false }),
          config: configDiagnostics,
          connectivity
        }),
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

    const email = normalizeEmail(body.email || '');
    const password = body.password || '';
    const next = body.next;

    if (!email || !password) {
      const { json } = await createRouteHandlerSupabase();
      return json({ error: 'Email and password are required.', code: 'validation' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      const { json } = await createRouteHandlerSupabase();
      return json({ error: 'Enter a valid email address.', code: 'validation' }, { status: 400 });
    }

    if (!validatePasswordLength(password)) {
      const { json } = await createRouteHandlerSupabase();
      return json({ error: 'Password must be between 6 and 128 characters.', code: 'validation' }, { status: 400 });
    }

    const { supabase, json, jsonWithAuthSession } = await createRouteHandlerSupabase();

    logAuthStep(ROUTE, 'sign_in', { host: configDiagnostics.urlHost || 'unknown' });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const isFetchFailure = error.message.toLowerCase().includes('fetch failed');
      const meta = requestClientMeta(request);
      await logSecurityEvent({
        eventType: isFetchFailure ? 'suspicious_activity' : 'login_failed',
        severity: 'warn',
        message: `Login failed for ${email.split('@')[1] || 'unknown domain'}`,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { code: error.message }
      });
      logAuthEvent('login_failed', {
        emailDomain: email.split('@')[1] || 'unknown',
        reason: error.message,
        host: configDiagnostics.urlHost || 'unknown',
        fetchFailure: isFetchFailure ? 1 : 0
      });

      const mapped = mapAuthError(error.message);
      return json(
        secureLoginPayload({
          error: isFetchFailure
            ? 'Supabase auth request failed from the server. Verify Supabase URL/key in Vercel and that the project is active.'
            : mapped.message,
          title: isFetchFailure ? 'Supabase connection failed' : mapped.title,
          details: isFetchFailure
            ? `${error.message}. Host: ${configDiagnostics.urlHost || 'unknown'}. Connectivity: ${connectivity.latencyMs}ms.`
            : mapped.details,
          code: error.message,
          supabaseMessage: error.message,
          diagnostics: workspaceDiagnostics({ authStep: 'sign_in', sessionVerified: false }),
          config: configDiagnostics,
          connectivity
        }),
        { status: isFetchFailure ? 503 : 401 }
      );
    }

    const user = data.user;
    if (!user) {
      return json(
        secureLoginPayload({
          error: 'Sign in did not return a user session.',
          title: 'Session missing',
          code: 'no_user',
          diagnostics: workspaceDiagnostics({ authStep: 'sign_in', sessionVerified: false }),
          config: configDiagnostics,
          connectivity
        }),
        { status: 500 }
      );
    }

    logAuthStep(ROUTE, 'session_verify', { userId: user.id });
    const {
      data: { user: verifiedUser },
      error: verifyError
    } = await supabase.auth.getUser();

    if (verifyError || !verifiedUser) {
      logAuthEvent('session_verify_failed', { userId: user.id, reason: verifyError?.message || 'no user' });
      return json(
        secureLoginPayload({
          error: 'Supabase accepted your credentials but the session cookie was not saved. Try again or contact support.',
          title: 'Session not persisted',
          details: verifyError?.message || 'getUser() returned no session after signInWithPassword.',
          code: 'session_not_persisted',
          supabaseMessage: verifyError?.message,
          diagnostics: workspaceDiagnostics({
            authStep: 'session_verify',
            userId: user.id,
            sessionVerified: false
          }),
          config: configDiagnostics,
          connectivity
        }),
        { status: 500 }
      );
    }

    logAuthStep(ROUTE, 'workspace_bootstrap', { userId: user.id });
    const bootstrap = await ensureUserWorkspace(user.id, email, user.user_metadata || undefined, supabase);

    if (!bootstrap.ok) {
      await supabase.auth.signOut();
      const bootstrapTitle =
        bootstrap.code === 'schema_mismatch'
          ? 'Database schema out of date'
          : bootstrap.code === 'bootstrap_unavailable'
            ? 'Workspace setup unavailable'
            : 'Workspace setup required';

      return json(
        secureLoginPayload({
          error: bootstrap.message,
          title: bootstrapTitle,
          details: bootstrap.details,
          code: bootstrap.code,
          setupRequired: bootstrap.code !== 'schema_mismatch',
          diagnostics: workspaceDiagnostics({
            authStep: 'workspace_bootstrap',
            userId: user.id,
            sessionVerified: true,
            profile: bootstrap.profileSnapshot ?? null,
            hasMembership: bootstrap.hasMembership,
            profileLookupRan: true,
            membershipLookupRan: bootstrap.code !== 'profile_read_failed'
          }),
          config: configDiagnostics,
          connectivity
        }),
        {
          status:
            bootstrap.code === 'bootstrap_unavailable' || bootstrap.code === 'schema_mismatch' ? 503 : 409
        }
      );
    }

    const profile = bootstrap.profile;

    if (!isAccountActive(profile.account_status)) {
      await supabase.auth.signOut();
      logAuthEvent('login_blocked_disabled', { userId: user.id });
      const mapped = mapAuthError('account_disabled', 'account_disabled');
      return json(
        secureLoginPayload({
          error: mapped.message,
          title: mapped.title,
          details: mapped.details,
          code: 'account_disabled',
          diagnostics: workspaceDiagnostics({
            authStep: 'workspace_bootstrap',
            userId: user.id,
            sessionVerified: true,
            profile,
            hasMembership: true,
            profileLookupRan: true,
            membershipLookupRan: true
          }),
          config: configDiagnostics,
          connectivity
        }),
        { status: 403 }
      );
    }

    let onboardingCompleted = true;
    let onboardingSkipped = false;
    if (profile.organization_id) {
      const { data: settings } = await supabase
        .from('organization_settings')
        .select('onboarding_completed, onboarding_skipped')
        .eq('organization_id', profile.organization_id)
        .maybeSingle();
      onboardingCompleted = Boolean(settings?.onboarding_completed);
      onboardingSkipped = Boolean(settings?.onboarding_skipped);
    }

    const redirectTo = postAuthRedirectPath(profile.role, next, onboardingCompleted, onboardingSkipped);

    logAuthEvent('login_success', {
      userId: user.id,
      role: profile.role,
      bootstrapped: bootstrap.created ? 1 : 0,
      host: configDiagnostics.urlHost || 'unknown'
    });

    const meta = requestClientMeta(request);
    await logSecurityEvent({
      organizationId: profile.organization_id,
      userId: user.id,
      eventType: 'login_success',
      message: 'User signed in',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    });
    if (profile.organization_id) {
      await logActivityServer({
        organizationId: profile.organization_id,
        userId: user.id,
        actorName: email,
        entityType: 'auth',
        action: 'login',
        message: 'User signed in'
      });
    }

    return jsonWithAuthSession(
      secureLoginPayload({
        ok: true,
        redirectTo,
        role: profile.role,
        plan: profile.plan,
        subscriptionStatus: profile.subscription_status,
        workspaceCreated: bootstrap.created,
        diagnostics: workspaceDiagnostics({
          authStep: 'complete',
          userId: verifiedUser.id,
          sessionVerified: true,
          profile,
          hasMembership: Boolean(profile.organization_id),
          profileLookupRan: true,
          membershipLookupRan: true
        }),
        config: configDiagnostics,
        connectivity
      })
    );
  } catch (err) {
    logAuthEvent('login_route_exception', { reason: err instanceof Error ? err.message : String(err) });
    const { json } = await createRouteHandlerSupabase();
    return json(
      sanitizeErrorPayload({
        error: 'Sign-in failed due to a server error.',
        title: 'Server error',
        details: safeErrorMessage(err, 'Sign-in failed due to a server error.'),
        code: 'login_route_exception',
        diagnostics: workspaceDiagnostics({ authStep: 'sign_in', sessionVerified: false }),
        config: configDiagnostics
      }),
      { status: 500 }
    );
  }
}
