import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { safeNextPath } from '@/lib/app-url';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));
  const authError = searchParams.get('error_description') || searchParams.get('error');

  if (authError) {
    const login = new URL('/login', origin);
    login.searchParams.set('error', authError);
    return NextResponse.redirect(login);
  }

  if (!code) {
    const login = new URL('/login', origin);
    login.searchParams.set('error', 'missing_auth_code');
    return NextResponse.redirect(login);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
    {
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
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const login = new URL('/login', origin);
    const expired =
      error.message.toLowerCase().includes('expired') ||
      error.message.toLowerCase().includes('invalid') ||
      error.message.toLowerCase().includes('otp');
    login.searchParams.set(
      'error',
      expired ? 'This link has expired or is invalid. Request a new one.' : error.message
    );
    return NextResponse.redirect(login);
  }

  const verified = searchParams.get('type') === 'signup' || next.includes('onboarding');
  const destination = verified ? `${next}${next.includes('?') ? '&' : '?'}verified=1` : next;

  return NextResponse.redirect(`${origin}${destination}`);
}
