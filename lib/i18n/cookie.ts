import { LOCALE_COOKIE_NAME, normalizeLocale, type Locale } from '@/lib/i18n/config';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function readLocaleCookie(): Locale | null {
  if (typeof document === 'undefined') return null;
  const pattern = new RegExp(`(?:^|; )${LOCALE_COOKIE_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]+)`);
  const match = document.cookie.match(pattern);
  if (!match?.[1]) return null;
  try {
    return normalizeLocale(decodeURIComponent(match[1]));
  } catch {
    return normalizeLocale(match[1]);
  }
}

export function writeLocaleCookie(locale: Locale): void {
  if (typeof document === 'undefined') return;
  const normalized = normalizeLocale(locale);
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(normalized)}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}
