import { NextResponse } from 'next/server';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';
import { DEFAULT_LOCALE, LOCALE_COOKIE, normalizeAppLocale, type AppLocale } from '@/i18n/routing';

export async function POST(request: Request) {
  let body: { locale?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const locale = normalizeAppLocale(body.locale);
  const { supabase, json } = await createRouteHandlerSupabase();
  const response = json({ ok: true, locale });

  response.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });

  try {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      await supabase.from('profiles').update({ locale }).eq('id', user.id);
    }
  } catch {
    /* cookie still applies for guests */
  }

  return response;
}

export async function GET() {
  const { supabase, json } = await createRouteHandlerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  let locale: AppLocale = DEFAULT_LOCALE;

  if (user) {
    const { data } = await supabase.from('profiles').select('locale').eq('id', user.id).maybeSingle();
    locale = normalizeAppLocale(data?.locale);
  }

  return json({ locale });
}
