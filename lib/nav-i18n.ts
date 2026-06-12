import type { Messages } from '@/lib/i18n/types';

const NAV_HREF_KEYS: Record<string, keyof Messages['nav']> = {
  '/dashboard': 'dashboard',
  '/jobs': 'jobs',
  '/customers': 'customers',
  '/schedule': 'schedule',
  '/workers': 'workers',
  '/team': 'team',
  '/activity': 'activity',
  '/analytics': 'analytics',
  '/workflows': 'workflows',
  '/notifications': 'notifications',
  '/settings/billing': 'billing',
  '/settings': 'settings',
  '/portal/client': 'clientPortal',
  '/portal/contractor': 'contractorPortal'
};

const SETTINGS_HREF_KEYS: Record<string, keyof Messages['settingsNav']> = {
  '/settings': 'workspace',
  '/settings/team': 'team',
  '/settings/branding': 'branding',
  '/settings/integrations': 'integrations',
  '/settings/account': 'account',
  '/settings/billing': 'billing',
  '/settings/security': 'security',
  '/settings/privacy': 'privacy',
  '/settings/notifications': 'notifications',
  '/settings/api': 'api',
  '/settings/departments': 'departments'
};

export function navLabel(href: string, t: (key: string) => string, fallback: string): string {
  const key = NAV_HREF_KEYS[href];
  return key ? t(`nav.${key}`) : fallback;
}

export function settingsNavLabel(href: string, t: (key: string) => string, fallback: string): string {
  const key = SETTINGS_HREF_KEYS[href];
  return key ? t(`settingsNav.${key}`) : fallback;
}
