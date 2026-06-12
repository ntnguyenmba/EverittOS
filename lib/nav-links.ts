import { isFeatureEnabled } from '@/lib/feature-flags';

const CORE_NAV = [
  { label: 'Command Center', href: '/dashboard' },
  { label: 'CRM', href: '/customers' },
  { label: 'Jobs', href: '/jobs' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Workers', href: '/workers' },
  { label: 'Expenses', href: '/expenses' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Plans & billing', href: '/settings/billing' },
  { label: 'Settings', href: '/settings' }
] as const;

const OPTIONAL_NAV = [
  { label: 'Projects', href: '/projects', flag: 'projectsNav' as const },
  { label: 'Knowledge', href: '/knowledge', flag: 'knowledgeNav' as const },
  { label: 'Automations', href: '/automations', flag: 'automationsNav' as const },
  { label: 'Clients', href: '/clients', flag: 'clientsNavPage' as const },
  { label: 'Forms', href: '/forms', flag: 'formsNav' as const },
  { label: 'Templates', href: '/templates', flag: 'templatesNav' as const },
  { label: 'Reviews', href: '/reviews', flag: 'reviewsNav' as const },
  { label: 'Leads', href: '/leads', flag: 'leadsNav' as const }
] as const;

function buildNavLinks() {
  const optional = OPTIONAL_NAV.filter((item) => isFeatureEnabled(item.flag));
  // Insert optional modules after Jobs
  const head = CORE_NAV.slice(0, 3);
  const tail = CORE_NAV.slice(3);
  return [...head, ...optional, ...tail];
}

/** Main app sidebar / mobile nav entries in display order. */
export const APP_NAV_LINKS = buildNavLinks();

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
