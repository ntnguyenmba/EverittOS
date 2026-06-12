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
  '/leads': 'leads',
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
  '/settings/support': 'supportTraining',
  '/settings/api': 'api',
  '/settings/ai-memory': 'aiMemory',
  '/settings/departments': 'departments'
};

const NAV_SECTION_KEYS: Record<string, keyof Messages['nav']> = {
  tools: 'sectionTools',
  insights: 'sectionInsights'
};

export function navLabel(href: string, t: (key: string) => string, fallback: string): string {
  const key = NAV_HREF_KEYS[href];
  return key ? t(`nav.${key}`) : fallback;
}

export function navSectionLabel(sectionId: string, t: (key: string) => string): string | null {
  const key = NAV_SECTION_KEYS[sectionId];
  return key ? t(`nav.${key}`) : null;
}

export function settingsNavLabel(href: string, t: (key: string) => string, fallback: string): string {
  const key = SETTINGS_HREF_KEYS[href];
  return key ? t(`settingsNav.${key}`) : fallback;
}
