'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/components/locale-provider';
import { LOCALE_STORAGE_KEY, normalizeLocale } from '@/lib/i18n/config';
import { writeLocaleCookie } from '@/lib/i18n/cookie';
import { isSessionExemptPath } from '@/lib/session-policy';

/** Load the signed-in profile locale once without overwriting a live user choice. */
export function LocaleSync() {
  const pathname = usePathname() || '/';
  const { setLocale } = useLocale();
  const hasSynced = useRef(false);
  const userChangedLocale = useRef(false);

  useEffect(() => {
    const onLocaleChange = () => {
      userChangedLocale.current = true;
    };

    window.addEventListener('everittos:locale-change', onLocaleChange);
    return () => {
      window.removeEventListener('everittos:locale-change', onLocaleChange);
    };
  }, []);

  useEffect(() => {
    if (hasSynced.current || isSessionExemptPath(pathname)) return;
    hasSynced.current = true;

    const controller = new AbortController();

    async function syncLocale() {
      try {
        const res = await fetch('/api/account/locale', {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal
        });
        if (!res.ok || userChangedLocale.current) return;

        const json = await res.json();
        const stored = typeof json.locale === 'string' ? json.locale : null;
        if (!stored || userChangedLocale.current) return;

        const next = normalizeLocale(stored);
        setLocale(next);
        try {
          localStorage.setItem(LOCALE_STORAGE_KEY, next);
        } catch {
          /* ignore */
        }
        writeLocaleCookie(next);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          /* Locale sync is best-effort; the saved local choice remains active. */
        }
      }
    }

    void syncLocale();
    return () => controller.abort();
  }, [pathname, setLocale]);

  return null;
}
