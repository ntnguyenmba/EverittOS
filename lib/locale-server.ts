import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_LOCALE, LOCALE_COOKIE, normalizeAppLocale, type AppLocale } from '@/i18n/routing';

export async function readLocaleCookie(): Promise<AppLocale> {
  const cookieStore = await cookies();
  return normalizeAppLocale(cookieStore.get(LOCALE_COOKIE)?.value);
}

export async function fetchProfileLocale(client: SupabaseClient, userId: string): Promise<AppLocale | null> {
  const { data, error } = await client.from('profiles').select('locale').eq('id', userId).maybeSingle();

  if (error || !data?.locale) return null;
  return normalizeAppLocale(data.locale);
}

export async function resolveUserLocale(client: SupabaseClient, userId: string | null | undefined): Promise<AppLocale> {
  if (userId) {
    const profileLocale = await fetchProfileLocale(client, userId);
    if (profileLocale) return profileLocale;
  }

  return readLocaleCookie().catch(() => DEFAULT_LOCALE);
}
