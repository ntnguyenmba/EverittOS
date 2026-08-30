import type { Messages } from '@/lib/i18n/types';
import type { Locale } from '@/lib/i18n/config';
import { getPlaybookCopy } from '@/lib/i18n/playbook-copy';

const NAV_HREF_KEYS: Record<string, keyof Messages['nav']> = {
  '/dashboard': 'dashboard',
  '/jobs': 'jobs',
  '/customers': 'crm',
  '/projects': 'projects',
  '/schedule': 'schedule',
  '/expenses': 'expenses',
  '/knowledge': 'knowledge',
  '/automations': 'automations',
  '/clients': 'clients',
  '/workers': 'workers',
  '/people': 'team',
  '/team': 'team',
  '/activity': 'activity',
  '/analytics': 'analytics',
  '/forms': 'forms',
  '/templates': 'templates',
  '/reviews': 'reviews',
  '/proposals': 'proposals',
  '/estimates': 'estimates',
  '/invoices': 'invoices',
  '/messages': 'messages',
  '/inventory': 'inventory',
  '/routes': 'routes',
  '/photos': 'photos',
  '/leads': 'leads',
  '/services': 'services',
  '/bookings': 'bookings',
  '/workflows': 'workflows',
  '/notifications': 'notifications',
  '/settings/billing': 'billing',
  '/settings': 'settings',
  '/portal/client': 'clientPortal',
  '/portal/contractor': 'contractorPortal'
};

const DASHBOARD_LABEL: Record<Locale, string> = {
  en: 'Dashboard',
  es: 'Panel',
  vi: 'Bảng điều khiển'
};

const QUOTES_LABEL: Record<Locale, string> = {
  en: 'Quotes',
  es: 'Cotizaciones',
  vi: 'Báo giá'
};

function usableLabel(value: string | undefined, missingPrefix: string) {
  if (!value) return '';
  if (value === missingPrefix || value === `[[${missingPrefix}]]`) return '';
  if (value.startsWith('[[') || value.startsWith('nav.')) return '';
  return value;
}

export function navLabel(href: string, t: (key: string) => string, fallback: string, locale?: Locale): string {
  const path = href.split(/[?#]/)[0];
  if (path === '/dashboard') {
    return usableLabel(t('nav.dashboard'), 'nav.dashboard') || (locale && DASHBOARD_LABEL[locale]) || fallback || DASHBOARD_LABEL.en;
  }
  if (path === '/quotes' || path === '/pricing-helper') {
    return (locale && QUOTES_LABEL[locale]) || fallback || QUOTES_LABEL.en;
  }
  if (path === '/assistant') return locale === 'es' ? 'Asistente' : locale === 'vi' ? 'Trợ lý' : 'Assistant';
  if (path === '/knowledge' && locale) return getPlaybookCopy(locale).navLabel;
  const key = NAV_HREF_KEYS[path];
  if (!key) return fallback;
  return usableLabel(t(`nav.${key}`), `nav.${key}`) || fallback;
}
