import { LOCALE_STORAGE_KEY, normalizeLocale, type Locale } from '@/lib/i18n/config';
import { readLocaleCookie, writeLocaleCookie } from '@/lib/i18n/cookie';
import { supabase } from '@/lib/supabase';

/** Persist locale in localStorage, cookie, and profile when signed in. */
export async function persistLocaleChoice(locale: Locale): Promise<void> {
  const normalized = normalizeLocale(locale);
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, normalized);
  } catch {
    /* ignore */
  }

  writeLocaleCookie(normalized);

  try {
    await fetch('/api/account/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: normalized })
    });
  } catch {
    /* profile/cookie sync is best-effort; local preference still applies */
  }
}
