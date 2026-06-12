import { isFeatureEnabled, type FeatureFlag } from '@/lib/feature-flags';

export type NavLinkDef = {
  label: string;
  href: string;
  flag?: FeatureFlag;
};

export type NavSectionDef = {
  id: string;
  items: NavLinkDef[];
};

const PRIMARY_NAV: NavLinkDef[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Customers', href: '/customers' },
  { label: 'Jobs', href: '/jobs' },
  { label: 'Leads', href: '/leads', flag: 'leadsNav' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Team', href: '/team' }
];

const TOOLS_NAV: NavLinkDef[] = [
  { label: 'Forms', href: '/forms', flag: 'formsNav' },
  { label: 'Templates', href: '/templates', flag: 'templatesNav' },
  { label: 'Reviews', href: '/reviews', flag: 'reviewsNav' }
];

const INSIGHTS_NAV: NavLinkDef[] = [
  { label: 'Expenses', href: '/expenses' },
  { label: 'Analytics', href: '/analytics' }
];

const SETTINGS_NAV: NavLinkDef[] = [{ label: 'Settings', href: '/settings' }];

function filterFlagged(items: NavLinkDef[]): NavLinkDef[] {
  return items.filter((item) => !item.flag || isFeatureEnabled(item.flag));
}

/** Grouped sidebar navigation in display order. */
export const APP_NAV_SECTIONS: NavSectionDef[] = [
  { id: 'primary', items: PRIMARY_NAV },
  { id: 'tools', items: filterFlagged(TOOLS_NAV) },
  { id: 'insights', items: INSIGHTS_NAV },
  { id: 'settings', items: SETTINGS_NAV }
];

/** Flat list for access checks and legacy callers. */
export const APP_NAV_LINKS = APP_NAV_SECTIONS.flatMap((section) => section.items);

export type AppNavHref = (typeof APP_NAV_LINKS)[number]['href'];

/** Routes kept out of primary nav but fully routable. */
export const SECONDARY_APP_ROUTES = [
  '/workers',
  '/team',
  '/activity',
  '/workflows',
  '/notifications',
  '/proposals',
  '/projects',
  '/knowledge',
  '/automations',
  '/clients',
  '/portal/client',
  '/portal/contractor'
] as const;
