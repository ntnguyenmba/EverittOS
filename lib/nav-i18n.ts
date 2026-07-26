import type { Messages } from '@/lib/i18n/types';

const NAV_HREF_KEYS: Record<string, keyof Messages['nav']> = {
  '/dashboard': 'commandCenter',
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

export function navLabel(href: string, t: (key: string) => string, fallback: string): string {
  const key = NAV_HREF_KEYS[href];
  return key ? t(`nav.${key}`) : fallback;
}
