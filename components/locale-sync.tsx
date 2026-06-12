'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/components/locale-provider';
import { LOCALE_STORAGE_KEY, normalizeLocale } from '@/lib/i18n/config';
import { isSessionExemptPath } from '@/lib/session-policy';
import { supabase } from '@/lib/supabase';

/** Sync locale from profile preference after sign-in. */
export function LocaleSync() {
  const pathname = usePathname() || '/';
  const { setLocale } = useLocale();

  useEffect(() => {
    if (isSessionExemptPath(pathname)) return;

    async function syncLocale() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;

      const res = await fetch('/api/account/privacy');
      if (!res.ok) return;

      const json = await res.json();
      const stored =
        typeof json.locale === 'string'
          ? json.locale
          : typeof json.preferred_locale === 'string'
            ? json.preferred_locale
            : null;
      if (stored) {
        const next = normalizeLocale(stored);
        setLocale(next);
        try {
          localStorage.setItem(LOCALE_STORAGE_KEY, next);
        } catch {
          /* ignore */
        }
      }
    }

    void syncLocale();
  }, [pathname, setLocale]);

  return null;
}
