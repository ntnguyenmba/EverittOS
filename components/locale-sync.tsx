'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/components/locale-provider';
import { LOCALE_STORAGE_KEY, normalizeLocale } from '@/lib/i18n/config';
import { writeLocaleCookie } from '@/lib/i18n/cookie';
import { isSessionExemptPath } from '@/lib/session-policy';

/** Sync locale from profile preference after sign-in. */
export function LocaleSync() {
  const pathname = usePathname() || '/';
  const { setLocale } = useLocale();

  useEffect(() => {
    if (isSessionExemptPath(pathname)) return;

    async function syncLocale() {
      const res = await fetch('/api/account/locale', { cache: 'no-store' });
      if (!res.ok) return;

      const json = await res.json();
      const stored = typeof json.locale === 'string' ? json.locale : null;
      if (!stored) return;

      const next = normalizeLocale(stored);
      setLocale(next);
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      writeLocaleCookie(next);
    }

    void syncLocale();
  }, [pathname, setLocale]);

  return null;
}
