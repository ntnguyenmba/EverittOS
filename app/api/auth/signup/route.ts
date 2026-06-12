import { mapAuthError } from '@/lib/auth-errors';
import { logAuthEvent } from '@/lib/auth-logger';
import { logAuthStep } from '@/lib/auth-diagnostics';
import { logAuthDebug } from '@/lib/auth-debug';
import { confirmEmailRedirectUrl } from '@/lib/auth-redirect-urls';
import { isValidEmail, normalizeEmail, validatePasswordLength } from '@/lib/input-validation';
import { sanitizeAuthErrorPayload, safeErrorMessage } from '@/lib/safe-api-error';
import { checkSupabaseConnectivity } from '@/lib/supabase-connectivity';
import { isSupabaseConfigured, supabaseConfigDiagnostics } from '@/lib/supabase-config';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';

export const runtime = 'nodejs';

const ROUTE = 'signup';

function secureSignupPayload(body: Record<string, unknown>): Record<string, unknown> {
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
        secureSignupPayload({
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
        secureSignupPayload({
          error: 'Cannot reach Supabase from this deployment. Check NEXT_PUBLIC_SUPABASE_URL and redeploy.',
          title: 'Supabase unreachable',
          code: 'supabase_unreachable',
          supabaseMessage: connectivity.error,
          diagnostics,
          connectivity
        }),
        { status: 503 }
      );
    }

    let body: {
      email?: string;
      password?: string;
      businessName?: string;
      selectedPlan?: string;
      next?: string;
    };
    try {
      body = await request.json();
    } catch {
      const { json } = await createRouteHandlerSupabase();
      return json({ error: 'Invalid request body.', code: 'bad_request' }, { status: 400 });
    }

    const email = normalizeEmail(body.email || '');
    const password = body.password || '';
    const businessName = (body.businessName || '').trim();
    const selectedPlan = (body.selectedPlan || 'free').trim();
    const next = body.next || '/onboarding';

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
      return json(
        { error: 'Password must be between 6 and 128 characters.', code: 'validation' },
        { status: 400 }
      );
    }

    const { supabase, json, jsonWithAuthSession } = await createRouteHandlerSupabase();
    const emailRedirectTo = confirmEmailRedirectUrl(next);
    logAuthDebug('signup_email_redirect', { emailRedirectTo });

    logAuthStep(ROUTE, 'sign_in', {
      host: diagnostics.urlHost || 'unknown',
      emailDomain: email.split('@')[1] || 'unknown'
    });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          business_name: businessName || null,
          selected_plan: selectedPlan
        }
      }
    });

    if (error) {
      const isFetchFailure = error.message.toLowerCase().includes('fetch failed');
      logAuthEvent('signup_failed', {
        reason: error.message,
        host: diagnostics.urlHost || 'unknown',
        emailDomain: email.split('@')[1] || 'unknown'
      });
      const mapped = mapAuthError(error.message);
      return json(
        secureSignupPayload({
          error: isFetchFailure
            ? 'We could not complete signup right now. Try again in a moment or contact support.'
            : mapped.message,
          title: isFetchFailure ? 'Supabase connection failed' : mapped.title,
          code: mapped.code || error.message,
          supabaseMessage: error.message,
          diagnostics,
          connectivity
        }),
        { status: isFetchFailure ? 503 : 400 }
      );
    }

    logAuthEvent('signup_success', {
      userId: data.user?.id || 'unknown',
      sessionCreated: data.session ? 1 : 0,
      confirmationRequired: data.session ? 0 : 1,
      host: diagnostics.urlHost || 'unknown',
      emailDomain: email.split('@')[1] || 'unknown'
    });

    if (data.session) {
      return jsonWithAuthSession(
        secureSignupPayload({
          ok: true,
          confirmationRequired: false,
          userId: data.user?.id,
          diagnostics,
          connectivity
        })
      );
    }

    return json(
      secureSignupPayload({
        ok: true,
        confirmationRequired: true,
        message:
          'Account created. Check your email and click the confirmation link, then sign in with your email and password.',
        diagnostics,
        connectivity
      })
    );
  } catch (err) {
    logAuthEvent('signup_route_exception', { reason: err instanceof Error ? err.message : String(err) });
    const { json } = await createRouteHandlerSupabase();
    return json(
      secureSignupPayload({
        error: safeErrorMessage(err, 'Signup failed due to a server error.'),
        title: 'Server error',
        code: 'signup_route_exception',
        supabaseMessage: err instanceof Error ? err.message : String(err),
        diagnostics
      }),
      { status: 500 }
    );
  }
}
