import { isFeatureEnabled, type FeatureFlag } from '@/lib/feature-flags';

export type NavLinkDef = {
  label: string;
  href: string;
  flag?: FeatureFlag;
};

export type NavSectionId = 'primary' | 'settings';

export type NavSectionDef = {
  id: NavSectionId;
  label: string;
  items: NavLinkDef[];
};

/** Slim primary navigation — role filtering happens in nav-access. */
const PRIMARY_NAV: NavLinkDef[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Jobs', href: '/jobs' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Customers', href: '/customers' },
  { label: 'Team', href: '/people' },
  { label: 'Expenses', href: '/expenses' },
  { label: 'Settings', href: '/settings' }
];

function filterFlagged(items: NavLinkDef[]): NavLinkDef[] {
  return items.filter((item) => !item.flag || isFeatureEnabled(item.flag));
}

export const APP_NAV_SECTIONS: NavSectionDef[] = [
  { id: 'primary', label: '', items: filterFlagged(PRIMARY_NAV) }
];

export const APP_NAV_LINKS = APP_NAV_SECTIONS.flatMap((section) => section.items);

export type AppNavHref = (typeof APP_NAV_LINKS)[number]['href'];

export const SECONDARY_APP_ROUTES = [
  '/operations',
  '/people',
  '/workers',
  '/team',
  '/photos',
  '/forms',
  '/templates',
  '/workflows',
  '/notifications',
  '/proposals',
  '/estimates',
  '/invoices',
  '/expenses',
  '/messages',
  '/projects',
  '/knowledge',
  '/automations',
  '/clients',
  '/services',
  '/bookings',
  '/inventory',
  '/routes',
  '/reports',
  '/leads',
  '/analytics',
  '/portal/client',
  '/portal/contractor',
  '/settings/billing',
  '/settings/account',
  '/settings/integrations',
  '/settings/job-instructions'
] as const;
