import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isAccountActive } from '@/lib/account-status';
import { logAuthEvent } from '@/lib/auth-logger';
import { mapAuthError } from '@/lib/auth-errors';
import { defaultPathForRole } from '@/lib/role-routes';
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

  let { data: profile } = await supabase
    .from('profiles')
    .select('role, plan, account_status, subscription_status')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    const businessName = (user.user_metadata?.business_name as string | undefined) || email.split('@')[0] || 'Workspace';
    const selectedPlan = (user.user_metadata?.selected_plan as string | undefined) || 'free';
    const { data: created, error: createError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email,
          business_name: businessName,
          role: 'owner',
          plan: selectedPlan,
          subscription_status: selectedPlan === 'free' ? 'free' : 'incomplete',
          account_status: 'active'
        },
        { onConflict: 'id' }
      )
      .select('role, plan, account_status, subscription_status')
      .maybeSingle();

    if (createError) {
      logAuthEvent('profile_bootstrap_failed', { userId: user.id, reason: createError.message });
    }
    profile = created || null;
  }

  if (!isAccountActive(profile?.account_status)) {
    await supabase.auth.signOut();
    logAuthEvent('login_blocked_disabled', { userId: user.id });
    const mapped = mapAuthError('account_disabled', 'account_disabled');
    return NextResponse.json(
      { error: mapped.message, title: mapped.title, details: mapped.details, code: 'account_disabled' },
      { status: 403 }
    );
  }

  const redirectTo = defaultPathForRole(profile?.role, next);
  logAuthEvent('login_success', { userId: user.id, role: profile?.role || 'owner' });

  return NextResponse.json({
    ok: true,
    redirectTo,
    role: profile?.role || 'owner',
    plan: profile?.plan || 'free',
    subscriptionStatus: profile?.subscription_status || 'free'
  });
}
