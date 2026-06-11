/** Shared app navigation href keys — labels come from i18n `nav.*` messages. */
export const APP_NAV_LINKS = [
  { key: 'dashboard', href: '/dashboard' },
  { key: 'jobs', href: '/jobs' },
  { key: 'customers', href: '/customers' },
  { key: 'schedule', href: '/schedule' },
  { key: 'workers', href: '/workers' },
  { key: 'team', href: '/team' },
  { key: 'activity', href: '/activity' },
  { key: 'analytics', href: '/analytics' },
  { key: 'workflows', href: '/workflows' },
  { key: 'notifications', href: '/notifications' },
  { key: 'billing', href: '/settings/billing' },
  { key: 'settings', href: '/settings' }
] as const;

export type AppNavKey = (typeof APP_NAV_LINKS)[number]['key'];

export const SETTINGS_NAV_KEYS = [
  { key: 'workspace', href: '/settings' },
  { key: 'team', href: '/settings/team' },
  { key: 'branding', href: '/settings/branding' },
  { key: 'integrations', href: '/settings/integrations' },
  { key: 'account', href: '/settings/account' },
  { key: 'billing', href: '/settings/billing' },
  { key: 'security', href: '/settings/security' },
  { key: 'api', href: '/settings/api' },
  { key: 'departments', href: '/settings/departments' }
] as const;

export type SettingsNavKey = (typeof SETTINGS_NAV_KEYS)[number]['key'];
