import type { Locale } from '@/lib/i18n/config';
import { normalizeLocale } from '@/lib/i18n/config';

/** BCP 47 tag for Intl formatting. */
export function localeTag(locale: Locale | string | null | undefined): string {
  const normalized = normalizeLocale(locale);
  if (normalized === 'es') return 'es-US';
  if (normalized === 'vi') return 'vi-VN';
  return 'en-US';
}

/** Visible USD amounts using the selected locale. */
export function formatMoneyUsd(
  value: number | null | undefined,
  locale: Locale | string | null | undefined
): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  return new Intl.NumberFormat(localeTag(locale), {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

/** Visible date using the selected locale. */
export function formatDateLocale(
  value: string | Date | null | undefined,
  locale: Locale | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(
    localeTag(locale),
    options || { month: 'long', day: 'numeric', year: 'numeric' }
  ).format(date);
}

/** Visible date+time using the selected locale. */
export function formatDateTimeLocale(
  value: string | Date | null | undefined,
  locale: Locale | string | null | undefined
): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(localeTag(locale), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}
