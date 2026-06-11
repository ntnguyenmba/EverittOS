import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { mapAuthError } from '@/lib/auth-errors';
import { safeNextPath } from '@/lib/app-url';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase-config';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));
  const authError = searchParams.get('error_description') || searchParams.get('error');
  const flowType = searchParams.get('type');

  if (authError) {
    const login = new URL('/login', origin);
    const mapped = mapAuthError(decodeURIComponent(authError));
    login.searchParams.set('error', mapped.message);
    login.searchParams.set('reason', flowType === 'recovery' ? 'reset' : 'auth');
    return NextResponse.redirect(login);
  }

  if (!code) {
    const login = new URL('/login', origin);
    login.searchParams.set('error', mapAuthError('missing_auth_code', 'missing_auth_code').message);
    return NextResponse.redirect(login);
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

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const target = flowType === 'recovery' ? '/forgot-password' : '/login';
    const page = new URL(target, origin);
    const mapped = mapAuthError(error.message, 'reset_link_expired');
    page.searchParams.set('error', mapped.message);
    return NextResponse.redirect(page);
  }

  if (flowType === 'recovery' || next === '/reset-password') {
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  const verified = searchParams.get('type') === 'signup' || next.includes('onboarding');
  const destination = verified ? `${next}${next.includes('?') ? '&' : '?'}verified=1` : next;

  return NextResponse.redirect(`${origin}${destination}`);
}
