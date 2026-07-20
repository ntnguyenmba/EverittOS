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
  { label: 'Jobs', href: '/jobs' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Customers', href: '/customers' },
  { label: 'People', href: '/people' },
  { label: 'Analytics', href: '/analytics' }
];

const WORKSPACE_NAV: NavLinkDef[] = [
  { label: 'Operations', href: '/operations' },
  { label: 'Forms', href: '/forms', flag: 'formsNav' },
  { label: 'Templates', href: '/templates', flag: 'templatesNav' },
  { label: 'Routes', href: '/routes', flag: 'routesNav' }
];

const BUSINESS_NAV: NavLinkDef[] = [
  { label: 'Leads', href: '/leads', flag: 'leadsNav' },
  { label: 'Bookings', href: '/bookings', flag: 'bookingsNav' },
  { label: 'Estimates', href: '/estimates', flag: 'estimatesNav' },
  { label: 'Invoices', href: '/invoices', flag: 'invoicesNav' },
  { label: 'Expenses', href: '/expenses' }
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
