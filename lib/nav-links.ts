/** Main app sidebar / mobile nav entries in display order. */
export const APP_NAV_LINKS = [
  { label: 'Command Center', href: '/dashboard' },
  { label: 'CRM', href: '/customers' },
  { label: 'Jobs', href: '/jobs' },
  { label: 'Projects', href: '/projects' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Knowledge', href: '/knowledge' },
  { label: 'Automations', href: '/automations' },
  { label: 'Clients', href: '/clients' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Billing', href: '/settings/billing' },
  { label: 'Settings', href: '/settings' }
] as const;

export type AppNavHref = (typeof APP_NAV_LINKS)[number]['href'];

/** Legacy routes kept for bookmarks and middleware; not in primary nav. */
export const SECONDARY_APP_ROUTES = [
  '/workers',
  '/team',
  '/activity',
  '/workflows',
  '/notifications',
  '/proposals',
  '/portal/client',
  '/portal/contractor'
] as const;
