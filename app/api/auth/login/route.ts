import { isAccountActive, isAccountDeleted } from '@/lib/account-status';
import { trackProductEventServer } from '@/lib/product-analytics-server';
import { logSecurityEvent, requestClientMeta } from '@/lib/security-events';
import { logAuthEvent } from '@/lib/auth-logger';
import { logAuthStep, workspaceDiagnostics } from '@/lib/auth-diagnostics';
import { diagnoseLoginFailure } from '@/lib/auth-user-diagnostics';
import { mapAuthError } from '@/lib/auth-errors';
import { isValidEmail, normalizeEmail, validatePasswordLength } from '@/lib/input-validation';
import { sanitizeAuthErrorPayload, safeErrorMessage } from '@/lib/safe-api-error';
import { repairClientPortalAccessForUser } from '@/lib/client-portal-repair';
import { postAuthRedirectPath } from '@/lib/post-auth-redirect';
import { ensureUserWorkspace, isRetryableBootstrapCode } from '@/lib/profile-bootstrap-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { isSupabaseConfigured, supabaseConfigDiagnostics } from '@/lib/supabase-config';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';
import { normalizeRole } from '@/lib/roles';

export const runtime = 'nodejs';

const ROUTE = 'login';
const SIDE_EFFECT_TIMEOUT_MS = 400;

function secureLoginPayload(body: Record<string, unknown>): Record<string, unknown> {
  return sanitizeAuthErrorPayload(body);
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function roleNeedsOnboarding(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role || 'owner');
  return normalized === 'owner' || normalized === 'admin';
}

export async function POST(request: Request) {
  const configDiagnostics = supabaseConfigDiagnostics();
  const startedAt = Date.now();

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
      const lower = error.message.toLowerCase();
      const needsDeepDiagnosis =
        !isFetchFailure &&
        (lower.includes('email') ||
          lower.includes('confirm') ||
          lower.includes('ban') ||
          lower.includes('disabled') ||
          lower.includes('not allowed'));

      const diagnosis = needsDeepDiagnosis ? await diagnoseLoginFailure(email) : null;
      const meta = requestClientMeta(request);

      // Failure logging must not delay the auth error response beyond a short budget.
      await withTimeout(
        logSecurityEvent({
          eventType: isFetchFailure ? 'suspicious_activity' : 'login_failed',
          severity: 'warn',
          message: `Login failed for ${email.split('@')[1] || 'unknown domain'}`,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          metadata: {
            code: error.message,
            diagnosisReason: diagnosis?.reason || 'unknown'
          }
        }),
        SIDE_EFFECT_TIMEOUT_MS
      );

      logAuthEvent('login_failed', {
        emailDomain: email.split('@')[1] || 'unknown',
        reason: error.message,
        diagnosisReason: diagnosis?.reason || 'unknown',
        host: configDiagnostics.urlHost || 'unknown',
        fetchFailure: isFetchFailure ? 1 : 0
      });

      const diagnosisMapped =
        diagnosis?.reason === 'email_not_confirmed'
          ? mapAuthError('email_not_confirmed', 'email_not_confirmed')
          : diagnosis?.reason === 'user_banned'
            ? mapAuthError('user_banned', 'user_banned')
            : null;

      const mapped = diagnosisMapped || mapAuthError(error.message);
      const displayError = isFetchFailure
        ? error.message ||
          'We could not reach the authentication service. Try again in a moment or contact support.'
        : mapped.message;

      return json(
        secureLoginPayload({
          error: displayError,
          title: isFetchFailure ? 'Supabase connection failed' : mapped.title,
          details: isFetchFailure ? error.message : mapped.details,
          code: mapped.code || error.message,
          supabaseMessage: error.message,
          diagnosisReason: diagnosis?.reason,
          diagnostics: workspaceDiagnostics({ authStep: 'sign_in', sessionVerified: false }),
          config: configDiagnostics
        }),
        { status: isFetchFailure ? 503 : 401 }
      );
    }

    const user = data.user;
    const session = data.session;
    if (!user || !session) {
      return json(
        secureLoginPayload({
          error: 'Sign in did not return a user session.',
          title: 'Session missing',
          code: 'no_user',
          diagnostics: workspaceDiagnostics({ authStep: 'sign_in', sessionVerified: false }),
          config: configDiagnostics
        }),
        { status: 500 }
      );
    }

    // Session cookie writing is handled by jsonWithAuthSession; skip redundant getUser().
    logAuthStep(ROUTE, 'workspace_bootstrap', { userId: user.id });
    let bootstrap = await ensureUserWorkspace(user.id, email, user.user_metadata || undefined, supabase);

    if (!bootstrap.ok && isRetryableBootstrapCode(bootstrap.code)) {
      logAuthEvent('workspace_bootstrap_retry', { userId: user.id, code: bootstrap.code });
      bootstrap = await ensureUserWorkspace(user.id, email, user.user_metadata || undefined, supabase);
    }

    if (!bootstrap.ok) {
      const keepSession = isRetryableBootstrapCode(bootstrap.code);
      if (!keepSession) {
        await supabase.auth.signOut();
      }

      const bootstrapTitle =
        bootstrap.code === 'schema_mismatch'
          ? 'Database schema out of date'
          : bootstrap.code === 'bootstrap_unavailable'
            ? 'Workspace setup unavailable'
            : 'Workspace setup required';

      logAuthEvent('workspace_bootstrap_failed', {
        userId: user.id,
        code: bootstrap.code,
        retryable: keepSession ? 1 : 0,
        reason: bootstrap.details || bootstrap.message
      });

      return json(
        secureLoginPayload({
          error: bootstrap.message,
          title: bootstrapTitle,
          code: bootstrap.code,
          setupRequired: keepSession || bootstrap.code === 'bootstrap_unavailable',
          retryable: keepSession,
          diagnostics: workspaceDiagnostics({
            authStep: 'workspace_bootstrap',
            userId: user.id,
            sessionVerified: keepSession,
            profile: bootstrap.profileSnapshot ?? null,
            hasMembership: bootstrap.hasMembership,
            profileLookupRan: true,
            membershipLookupRan: bootstrap.code !== 'profile_read_failed'
          }),
          config: configDiagnostics
        }),
        {
          status:
            bootstrap.code === 'bootstrap_unavailable' || bootstrap.code === 'schema_mismatch' ? 503 : 409
        }
      );
    }

    const profile = bootstrap.profile;

    if (isAccountDeleted(profile.deleted_at)) {
      await supabase.auth.signOut();
      logAuthEvent('login_blocked_deleted', { userId: user.id });
      const mapped = mapAuthError('account_deleted', 'account_deleted');
      return json(
        secureLoginPayload({
          error: mapped.message,
          title: mapped.title,
          details: mapped.details,
          code: 'account_deleted',
          diagnostics: workspaceDiagnostics({
            authStep: 'workspace_bootstrap',
            userId: user.id,
            sessionVerified: true,
            profile,
            hasMembership: true,
            profileLookupRan: true,
            membershipLookupRan: true
          }),
          config: configDiagnostics
        }),
        { status: 403 }
      );
    }

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
          config: configDiagnostics
        }),
        { status: 403 }
      );
    }

    // Repair incomplete client invite relationships from the prior subscription-wall bug.
    // Owners/managers/contractors are skipped by the repair routine.
    let effectiveRole = profile.role;
    let effectiveOrganizationId = profile.organization_id;
    let clientRepairRedirect: string | null = null;
    try {
      const admin = createAdminSupabase();
      const repair = await repairClientPortalAccessForUser(admin, user.id, email);
      if (repair.ok && !repair.skipped && repair.role) {
        effectiveRole = String(repair.role);
        if (repair.organizationId) effectiveOrganizationId = repair.organizationId;
        if (repair.redirectTo && normalizeRole(repair.role) === 'client') {
          clientRepairRedirect = repair.redirectTo;
        }
      }
    } catch {
      // Login must still succeed even if repair is unavailable.
    }

    let onboardingCompleted = true;
    let onboardingSkipped = false;
    if (effectiveOrganizationId && roleNeedsOnboarding(effectiveRole)) {
      const { data: settings } = await supabase
        .from('organization_settings')
        .select('onboarding_completed, onboarding_skipped')
        .eq('organization_id', effectiveOrganizationId)
        .maybeSingle();
      onboardingCompleted = Boolean(settings?.onboarding_completed);
      onboardingSkipped = Boolean(settings?.onboarding_skipped);
    }

    const redirectTo =
      clientRepairRedirect ||
      postAuthRedirectPath(effectiveRole, next, onboardingCompleted, onboardingSkipped);

    logAuthEvent('login_success', {
      userId: user.id,
      role: effectiveRole,
      bootstrapped: bootstrap.created ? 1 : 0,
      host: configDiagnostics.urlHost || 'unknown',
      ...(process.env.NODE_ENV === 'development' ? { durationMs: Date.now() - startedAt } : {})
    });

    const meta = requestClientMeta(request);
    // Side-effects must not block a successful login response.
    await Promise.allSettled([
      withTimeout(
        logSecurityEvent({
          organizationId: profile.organization_id,
          userId: user.id,
          eventType: 'login_success',
          message: 'User signed in',
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent
        }),
        SIDE_EFFECT_TIMEOUT_MS
      ),
      withTimeout(
        trackProductEventServer(supabase, 'login', {
          organizationId: profile.organization_id,
          userId: user.id
        }),
        SIDE_EFFECT_TIMEOUT_MS
      ),
      withTimeout(
        (async () => {
          const { error: rpcError } = await supabase.rpc('touch_profile_last_seen');
          if (!rpcError) return;
          await supabase
            .from('profiles')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', user.id);
        })(),
        SIDE_EFFECT_TIMEOUT_MS
      )
    ]);

    return jsonWithAuthSession(
      secureLoginPayload({
        ok: true,
        redirectTo,
        role: effectiveRole,
        plan: profile.plan,
        subscriptionStatus: profile.subscription_status,
        workspaceCreated: bootstrap.created,
        diagnostics: workspaceDiagnostics({
          authStep: 'complete',
          userId: user.id,
          sessionVerified: true,
          profile: { ...profile, role: effectiveRole, organization_id: effectiveOrganizationId },
          hasMembership: Boolean(effectiveOrganizationId),
          profileLookupRan: true,
          membershipLookupRan: true
        }),
        config: configDiagnostics
      })
    );
  } catch (err) {
    logAuthEvent('login_route_exception', { reason: err instanceof Error ? err.message : String(err) });
    const { json } = await createRouteHandlerSupabase();
    return json(
      sanitizeAuthErrorPayload({
        error: safeErrorMessage(err, 'Sign-in failed due to a server error.'),
        title: 'Server error',
        details: safeErrorMessage(err, 'Sign-in failed due to a server error.'),
        code: 'login_route_exception',
        supabaseMessage: err instanceof Error ? err.message : String(err),
        diagnostics: workspaceDiagnostics({ authStep: 'sign_in', sessionVerified: false }),
        config: configDiagnostics
      }),
      { status: 500 }
    );
  }
}
