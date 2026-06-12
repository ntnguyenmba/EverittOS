/** Primary bottom navigation — all other routes remain in the More menu. */
export const MOBILE_BOTTOM_NAV = [
  { href: '/dashboard', labelKey: 'nav.today' },
  { href: '/jobs', labelKey: 'nav.jobs' },
  { href: '/schedule', labelKey: 'nav.schedule' },
  { href: '/customers', labelKey: 'nav.crm' },
  { href: '__more__', labelKey: 'nav.more' }
] as const;
