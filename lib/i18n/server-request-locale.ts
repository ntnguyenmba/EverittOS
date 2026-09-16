import { LOCALE_COOKIE_NAME, normalizeLocale, type Locale } from '@/lib/i18n/config';

export function localeFromRequest(request: Request): Locale {
  const cookie = request.headers.get('cookie') || '';
  const pattern = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE_NAME.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}=([^;]+)`);
  const match = cookie.match(pattern);
  if (match?.[1]) {
    try {
      return normalizeLocale(decodeURIComponent(match[1]));
    } catch {
      return normalizeLocale(match[1]);
    }
  }
  const language = request.headers.get('accept-language')?.split(',')[0]?.trim().toLowerCase() || '';
  if (language.startsWith('es')) return 'es';
  if (language.startsWith('vi')) return 'vi';
  return 'en';
}
