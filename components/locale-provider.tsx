'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, normalizeLocale, type Locale } from '@/lib/i18n/config';
import { readLocaleCookie, writeLocaleCookie } from '@/lib/i18n/cookie';
import { formatMessage, getMessages, type Messages } from '@/lib/i18n/get-messages';
import { formatMissingTranslationKey } from '@/lib/i18n/fallback-key';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  messages: Messages;
  t: (path: string, values?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored) return normalizeLocale(stored);
  } catch {
    /* ignore */
  }
  return readLocaleCookie() || DEFAULT_LOCALE;
}

function applyDocumentLocale(locale: Locale) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;
  document.body.dataset.locale = locale;
}

function resolvePath(messages: Messages, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = messages;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const storedLocale = readStoredLocale();
    setLocaleState(storedLocale);
    applyDocumentLocale(storedLocale);
  }, []);

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    applyDocumentLocale(next);
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    writeLocaleCookie(next);
    window.dispatchEvent(new CustomEvent('everittos:locale-change', { detail: { locale: next } }));
  }, []);

  const messages = useMemo(() => getMessages(locale), [locale]);

  const t = useCallback(
    (path: string, values?: Record<string, string | number>) => {
      const enMessages = getMessages('en');
      const localized = resolvePath(messages, path);
      const english = resolvePath(enMessages, path);
      const template = localized ?? english;
      if (typeof template !== 'string') {
        return formatMissingTranslationKey(path);
      }
      return formatMessage(template, values);
    },
    [messages]
  );

  const value = useMemo(
    () => ({ locale, setLocale, messages, t }),
    [locale, setLocale, messages, t]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return ctx;
}

export function useTranslation() {
  const { t, locale, setLocale, messages } = useLocale();
  return { t, locale, setLocale, messages };
}
