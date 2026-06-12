import { LOCALE_STORAGE_KEY, normalizeLocale, type Locale } from '@/lib/i18n/config';
import { supabase } from '@/lib/supabase';

/** Persist locale in localStorage (all users) and profile when signed in. */
export async function persistLocaleChoice(locale: Locale): Promise<void> {
  const normalized = normalizeLocale(locale);
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, normalized);
  } catch {
    /* ignore */
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;

  try {
    await fetch('/api/account/privacy', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferred_locale: normalized, locale: normalized })
    });
  } catch {
    /* profile sync is best-effort; localStorage still applies */
  }
}
