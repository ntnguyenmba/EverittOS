import { isFeatureEnabled, type FeatureFlag } from '@/lib/feature-flags';

export type NavLinkDef = {
  label: string;
  href: string;
  flag?: FeatureFlag;
};

export type NavSectionId = 'primary' | 'workspace' | 'business' | 'settings';

export type NavSectionDef = {
  id: NavSectionId;
  showSectionLabel?: boolean;
  items: NavLinkDef[];
};

const PRIMARY_NAV: NavLinkDef[] = [
  { label: 'Home', href: '/dashboard' },
  { label: 'Leads', href: '/leads', flag: 'leadsNav' },
  { label: 'Customers', href: '/customers' },
  { label: 'Jobs', href: '/jobs' },
  { label: 'Calendar', href: '/schedule' },
  { label: 'Money', href: '/invoices', flag: 'invoicesNav' },
  { label: 'Team', href: '/people' },
  { label: 'Business', href: '/analytics' }
];

const SETTINGS_NAV: NavLinkDef[] = [{ label: 'Settings', href: '/settings' }];

function filterFlagged(items: NavLinkDef[]): NavLinkDef[] {
  return items.filter((item) => !item.flag || isFeatureEnabled(item.flag));
}

export const APP_NAV_SECTIONS: NavSectionDef[] = [
  { id: 'primary', items: filterFlagged(PRIMARY_NAV) },
  { id: 'settings', items: SETTINGS_NAV }
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
  '/portal/client',
  '/portal/contractor'
] as const;
