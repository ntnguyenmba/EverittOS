'use client';

import { useEffect } from 'react';
import { LOCALE_COOKIE, normalizeAppLocale } from '@/i18n/routing';
import { supabase } from '@/lib/supabase';

/** Sync authenticated user locale from Supabase profile into the locale cookie. */
export function LocaleBootstrap() {
  useEffect(() => {
    async function syncLocale() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('locale').eq('id', user.id).maybeSingle();
      const profileLocale = normalizeAppLocale(profile?.locale);
      const cookieMatch = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]+)`));
      const cookieLocale = normalizeAppLocale(cookieMatch?.[1] ? decodeURIComponent(cookieMatch[1]) : null);

      if (profileLocale !== cookieLocale) {
        await fetch('/api/account/locale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: profileLocale })
        });
      }
    }

    void syncLocale();
  }, []);

  return null;
}
