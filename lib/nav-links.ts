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
  { label: 'Overview', href: '/dashboard' },
  { label: 'Operations', href: '/operations' },
  { label: 'Customers', href: '/customers' },
  { label: 'Jobs', href: '/jobs' },
  { label: 'Schedule', href: '/schedule' }
];

// Keep the main menu focused on destinations that are not already handled
// inside job records. Photos, forms, templates, and routes remain available
// from their related job and operations workflows without duplicating them
// in the primary navigation.
const WORKSPACE_NAV: NavLinkDef[] = [
  { label: 'People', href: '/people' }
];

const BUSINESS_NAV: NavLinkDef[] = [
  { label: 'Leads', href: '/leads', flag: 'leadsNav' },
  { label: 'Bookings', href: '/bookings', flag: 'bookingsNav' },
  { label: 'Proposals', href: '/proposals', flag: 'proposalsNav' },
  { label: 'Estimates', href: '/estimates', flag: 'estimatesNav' },
  { label: 'Invoices', href: '/invoices', flag: 'invoicesNav' },
  { label: 'Expenses', href: '/expenses' },
  { label: 'Analytics', href: '/analytics' }
];

const SETTINGS_NAV: NavLinkDef[] = [{ label: 'Settings', href: '/settings' }];

function filterFlagged(items: NavLinkDef[]): NavLinkDef[] {
  return items.filter((item) => !item.flag || isFeatureEnabled(item.flag));
}

export const APP_NAV_SECTIONS: NavSectionDef[] = [
  { id: 'primary', items: PRIMARY_NAV },
  { id: 'workspace', showSectionLabel: true, items: filterFlagged(WORKSPACE_NAV) },
  { id: 'business', showSectionLabel: true, items: filterFlagged(BUSINESS_NAV) },
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
