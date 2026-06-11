/** Main app sidebar / mobile nav entries in display order. */
export const APP_NAV_LINKS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Jobs', href: '/jobs' },
  { label: 'Customers', href: '/customers' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Workers', href: '/workers' },
  { label: 'Team', href: '/team' },
  { label: 'Activity', href: '/activity' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Workflows', href: '/workflows' },
  { label: 'Notifications', href: '/notifications' },
  { label: 'Billing', href: '/settings/billing' },
  { label: 'Settings', href: '/settings' }
] as const;

export type AppNavHref = (typeof APP_NAV_LINKS)[number]['href'];
