export const LOCALES = ['en', 'es', 'vi'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_STORAGE_KEY = 'everittos_locale';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  vi: 'Tiếng Việt'
};

export function normalizeLocale(input: string | null | undefined): Locale {
  if (input === 'es' || input === 'vi') return input;
  return DEFAULT_LOCALE;
}
