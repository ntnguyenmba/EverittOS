import { defineRouting } from 'next-intl/routing';

export const LOCALES = ['en', 'es', 'vi'] as const;
export type AppLocale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'en';

export const LOCALE_COOKIE = 'everittos_locale';

export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: 'English',
  es: 'Español',
  vi: 'Tiếng Việt'
};

export const routing = defineRouting({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'never'
});

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return Boolean(value && LOCALES.includes(value as AppLocale));
}

export function normalizeAppLocale(value: string | null | undefined): AppLocale {
  if (isAppLocale(value)) return value;
  if (value?.startsWith('es')) return 'es';
  if (value?.startsWith('vi')) return 'vi';
  return DEFAULT_LOCALE;
}
