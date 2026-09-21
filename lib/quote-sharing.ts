import { normalizeLocale, type Locale } from '@/lib/i18n/config';

export type PublicQuote = {
  id: string;
  organization_name: string | null;
  status: string;
  service_type: string | null;
  price: number;
  currency: string | null;
  customer_name: string | null;
  notes: string | null;
  frequency: string | null;
  public_locale: string | null;
  shared_at: string | null;
  last_response_at: string | null;
};

export function quoteLocale(value: string | null | undefined): Locale {
  return normalizeLocale(value);
}

export function publicQuotePath(token: string, locale: Locale) {
  return `/q/${encodeURIComponent(token)}?lang=${locale}`;
}

export function absoluteQuoteUrl(origin: string, token: string, locale: Locale) {
  return new URL(publicQuotePath(token, locale), origin).toString();
}

export function formatQuoteMoney(price: number, currency: string | null | undefined, locale: Locale) {
  const tag = locale === 'es' ? 'es-US' : locale === 'vi' ? 'vi-VN' : 'en-US';
  try {
    return new Intl.NumberFormat(tag, { style: 'currency', currency: currency || 'USD' }).format(Number(price || 0));
  } catch {
    return `${currency || 'USD'} ${Number(price || 0).toFixed(2)}`;
  }
}

export function safeHtml(value: string | null | undefined) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);
}
