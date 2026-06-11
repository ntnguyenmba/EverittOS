import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { ensureUserWorkspace } from '@/lib/profile-bootstrap-server';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase-config';

/** Repair profile + organization access for the current session (e.g. legacy auth users). */
export async function POST() {
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

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Sign in required.', code: 'unauthorized' }, { status: 401 });
  }

  const bootstrap = await ensureUserWorkspace(user.id, user.email || '', user.user_metadata || undefined);

  if (!bootstrap.ok) {
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

  return NextResponse.json({
    ok: true,
    profile: bootstrap.profile,
    created: bootstrap.created,
    redirectTo: bootstrap.created ? '/onboarding?setup=1' : '/dashboard'
  });
}
