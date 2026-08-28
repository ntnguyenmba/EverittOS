import { isFeatureEnabled, type FeatureFlag } from '@/lib/feature-flags';

export type NavLinkDef = { label: string; href: string; flag?: FeatureFlag };
export type NavSectionId = 'primary' | 'settings';
export type NavSectionDef = { id: NavSectionId; label: string; items: NavLinkDef[] };

// Keep the daily owner workflow short. Existing modules remain available through
// direct routes and settings so no functionality is removed while the product
// focuses on the request -> quote -> job -> payment loop.
const PRIMARY_NAV: NavLinkDef[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Quotes', href: '/pricing-helper' },
  { label: 'Jobs', href: '/jobs' },
  { label: 'Customers', href: '/customers' },
  { label: 'Money', href: '/bookkeeping' },
  { label: 'Team', href: '/people' },
  { label: 'Settings', href: '/settings' },
];

function filterFlagged(items: NavLinkDef[]) {
  return items.filter((item) => !item.flag || isFeatureEnabled(item.flag));
}

export const APP_NAV_SECTIONS: NavSectionDef[] = [
  { id: 'primary', label: '', items: filterFlagged(PRIMARY_NAV) },
];

export const APP_NAV_LINKS = APP_NAV_SECTIONS.flatMap((section) => section.items);
export type AppNavHref = (typeof APP_NAV_LINKS)[number]['href'];

export const SECONDARY_APP_ROUTES = [
  '/leads',
  '/estimates',
  '/assistant',
  '/schedule',
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
  '/invoices',
  '/expenses',
  '/bookkeeping',
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
  '/analytics',
  '/activity',
  '/portal/client',
  '/portal/contractor',
  '/settings/billing',
  '/settings/account',
  '/settings/integrations',
  '/settings/job-instructions',
] as const;
