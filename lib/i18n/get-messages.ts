import { messages as en } from '@/lib/i18n/messages/en';
import { messages as es } from '@/lib/i18n/messages/es';
import { messages as vi } from '@/lib/i18n/messages/vi';
import type { Locale } from '@/lib/i18n/config';
import type { Messages } from '@/lib/i18n/types';

const catalogs: Record<Locale, Messages> = { en, es, vi };

export function getMessages(locale: Locale): Messages {
  return catalogs[locale] || catalogs.en;
}

/** Replace `{key}` placeholders in a template string. */
export function formatMessage(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export type { Messages } from '@/lib/i18n/types';
