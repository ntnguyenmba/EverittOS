export type NavLinkDef = {
  label: string;
  href: string;
};

export type NavSectionId = 'primary' | 'insights' | 'settings';

export type NavSectionDef = {
  id: NavSectionId;
  showSectionLabel?: boolean;
  items: NavLinkDef[];
};

const PRIMARY_NAV: NavLinkDef[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Leads', href: '/leads' },
  { label: 'Customers', href: '/customers' },
  { label: 'Jobs', href: '/jobs' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Photos', href: '/photos' },
  { label: 'People', href: '/people' }
];

const INSIGHTS_NAV: NavLinkDef[] = [
  { label: 'Expenses', href: '/expenses' },
  { label: 'Analytics', href: '/analytics' }
];

const SETTINGS_NAV: NavLinkDef[] = [{ label: 'Settings', href: '/settings' }];

export const APP_NAV_SECTIONS: NavSectionDef[] = [
  { id: 'primary', items: PRIMARY_NAV },
  { id: 'insights', showSectionLabel: true, items: INSIGHTS_NAV },
  { id: 'settings', items: SETTINGS_NAV }
];

export const APP_NAV_LINKS = APP_NAV_SECTIONS.flatMap((section) => section.items);

export type AppNavHref = (typeof APP_NAV_LINKS)[number]['href'];

export const SECONDARY_APP_ROUTES = [
  '/people',
  '/workers',
  '/team',
  '/activity',
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
