import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, normalizeLocale, type Locale } from '@/lib/i18n/config';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';

export const runtime = 'nodejs';

const COOKIE_OPTIONS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production'
};

function withLocaleCookie(response: NextResponse, locale: Locale): NextResponse {
  response.cookies.set(LOCALE_COOKIE_NAME, locale, COOKIE_OPTIONS);
  return response;
}

export async function GET() {
  const cookieStore = await cookies();
  const cookieLocale = normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const { supabase, json } = await createRouteHandlerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return json({ locale: cookieLocale || DEFAULT_LOCALE });
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('locale, preferred_locale')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const locale = normalizeLocale(data?.locale || data?.preferred_locale || cookieLocale || DEFAULT_LOCALE);
  return json({ locale });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { locale?: string };
  const locale = normalizeLocale(body.locale);
  const { supabase, json } = await createRouteHandlerSupabase();
  const response = withLocaleCookie(json({ ok: true, locale }), locale);

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const { error } = await supabase
      .from('profiles')
      .update({ locale, preferred_locale: locale })
      .eq('id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return response;
}
