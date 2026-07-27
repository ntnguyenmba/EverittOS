import { isFeatureEnabled, type FeatureFlag } from '@/lib/feature-flags';

export type NavLinkDef = {
  label: string;
  href: string;
  flag?: FeatureFlag;
};

export type NavSectionId =
  | 'operations'
  | 'customers'
  | 'financial'
  | 'team'
  | 'business'
  | 'settings';

export type NavSectionDef = {
  id: NavSectionId;
  label: string;
  items: NavLinkDef[];
};

const OPERATIONS_NAV: NavLinkDef[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Jobs', href: '/jobs' },
  { label: 'Schedule', href: '/schedule' }
];

const CUSTOMERS_NAV: NavLinkDef[] = [
  { label: 'Customers', href: '/customers' },
  { label: 'Leads', href: '/leads', flag: 'leadsNav' },
  { label: 'Reviews', href: '/reviews' }
];

const FINANCIAL_NAV: NavLinkDef[] = [
  { label: 'Invoices', href: '/invoices', flag: 'invoicesNav' },
  { label: 'Expenses', href: '/expenses' }
];

const TEAM_NAV: NavLinkDef[] = [{ label: 'People', href: '/people' }];

const BUSINESS_NAV: NavLinkDef[] = [
  { label: 'Reports', href: '/reports' },
  { label: 'Analytics', href: '/analytics' }
];

const SETTINGS_NAV: NavLinkDef[] = [
  { label: 'Account', href: '/settings/account' },
  { label: 'Integrations', href: '/settings/integrations' },
  { label: 'Billing', href: '/settings/billing' },
  { label: 'Settings', href: '/settings' }
];

function filterFlagged(items: NavLinkDef[]): NavLinkDef[] {
  return items.filter((item) => !item.flag || isFeatureEnabled(item.flag));
}

export const APP_NAV_SECTIONS: NavSectionDef[] = [
  { id: 'operations', label: 'Operations', items: filterFlagged(OPERATIONS_NAV) },
  { id: 'customers', label: 'Customers', items: filterFlagged(CUSTOMERS_NAV) },
  { id: 'financial', label: 'Financial', items: filterFlagged(FINANCIAL_NAV) },
  { id: 'team', label: 'Team', items: filterFlagged(TEAM_NAV) },
  { id: 'business', label: 'Business', items: filterFlagged(BUSINESS_NAV) },
  { id: 'settings', label: 'Settings', items: filterFlagged(SETTINGS_NAV) }
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
  '/portal/client',
  '/portal/contractor'
] as const;
