import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isAccountActive } from '@/lib/account-status';
import { logAuthEvent } from '@/lib/auth-logger';
import { mapAuthError } from '@/lib/auth-errors';
import { defaultPathForRole } from '@/lib/role-routes';
import { ensureUserWorkspace } from '@/lib/profile-bootstrap-server';
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from '@/lib/supabase-config';

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    logAuthEvent('login_config_missing');
    const mapped = mapAuthError('config_error', 'config_error');
    return NextResponse.json(
      { error: mapped.message, title: mapped.title, details: mapped.details, code: 'config_error' },
      { status: 503 }
    );
  }

  let body: { email?: string; password?: string; next?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.', code: 'bad_request' }, { status: 400 });
  }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const next = body.next;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.', code: 'validation' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      }
    }
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    logAuthEvent('login_failed', { emailDomain: email.split('@')[1] || 'unknown', reason: error.message });
    const mapped = mapAuthError(error.message);
    return NextResponse.json(
      { error: mapped.message, title: mapped.title, details: mapped.details, code: error.message },
      { status: 401 }
    );
  }

  const user = data.user;
  if (!user) {
    return NextResponse.json({ error: 'Sign in did not return a user session.', code: 'no_user' }, { status: 500 });
  }

  const bootstrap = await ensureUserWorkspace(user.id, email, user.user_metadata || undefined);

  if (!bootstrap.ok) {
    await supabase.auth.signOut();
    return NextResponse.json(
      {
        error: bootstrap.message,
        title: 'Workspace setup required',
        details: bootstrap.details,
        code: bootstrap.code,
        setupRequired: true
      },
      { status: 409 }
    );
  }

  const profile = bootstrap.profile;

  if (!isAccountActive(profile.account_status)) {
    await supabase.auth.signOut();
    logAuthEvent('login_blocked_disabled', { userId: user.id });
    const mapped = mapAuthError('account_disabled', 'account_disabled');
    return NextResponse.json(
      { error: mapped.message, title: mapped.title, details: mapped.details, code: 'account_disabled' },
      { status: 403 }
    );
  }

  let redirectTo = defaultPathForRole(profile.role, next);
  if (bootstrap.created && redirectTo === '/dashboard') {
    redirectTo = '/onboarding?setup=1';
  }

  logAuthEvent('login_success', { userId: user.id, role: profile.role, bootstrapped: bootstrap.created ? 1 : 0 });

  return NextResponse.json({
    ok: true,
    redirectTo,
    role: profile.role,
    plan: profile.plan,
    subscriptionStatus: profile.subscription_status,
    workspaceCreated: bootstrap.created
  });
}
