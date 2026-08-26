export const AUTH_PREFIXES = [
  '/dashboard','/jobs','/workers','/people','/settings','/customers','/crm','/schedule','/onboarding','/team','/teams','/activity','/analytics','/notifications','/billing','/workflows','/portal','/admin','/forms','/templates','/reviews','/leads','/services','/bookings','/invoices','/photos','/reports','/expenses','/projects','/knowledge','/automations','/clients','/proposals','/inventory','/routes','/messages','/estimates','/my-work','/contractor-pay','/staffing','/operations','/assistant'
] as const;

export const AUTH_ONLY_WHEN_LOGGED_OUT = ['/login', '/signup'] as const;

export const PUBLIC_API_PREFIXES = [
  '/api/auth/login','/api/auth/signup','/api/auth/reset-password','/api/auth/reset-session','/api/auth/update-password','/api/auth/config','/api/auth/setup','/api/auth/session','/api/auth/sign-out','/api/auth/signup-rate-limit','/api/stripe/webhook','/api/stripe/router','/api/stripe/capabilities','/api/public/reports','/api/webhooks/apple','/api/webhooks/google-play','/api/team/accept','/api/forms/public','/api/book'
] as const;

export const ROLE_BLOCKED_PREFIXES: ReadonlyArray<{ prefix: string; permission: 'view_team' | 'manage_billing' | 'view_all_org_data' }> = [
  { prefix: '/people', permission: 'view_team' },
  { prefix: '/team', permission: 'view_team' },
  { prefix: '/settings/people', permission: 'view_team' },
  { prefix: '/settings/team', permission: 'view_team' },
  { prefix: '/settings/billing', permission: 'manage_billing' }
];

export const MAIN_NAV_PATHS = [
  '/dashboard','/jobs','/customers','/crm','/projects','/schedule','/knowledge','/automations','/clients','/forms','/templates','/reviews','/services','/bookings','/leads','/workers','/people','/team','/teams','/activity','/analytics','/workflows','/notifications','/proposals','/invoices','/photos','/reports','/expenses','/inventory','/routes','/messages','/estimates','/my-work','/contractor-pay','/staffing','/operations','/assistant'
] as const;

export function pathMatchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicApiPath(pathname: string) {
  return PUBLIC_API_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix));
}

export function isSessionApiPath(pathname: string) {
  return pathname.startsWith('/api/') && !pathname.startsWith('/api/v1/') && !isPublicApiPath(pathname);
}

export function isProtectedPath(pathname: string) {
  return AUTH_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix));
}

export function isLoggedOutOnlyPath(pathname: string) {
  return AUTH_ONLY_WHEN_LOGGED_OUT.some((prefix) => pathMatchesPrefix(pathname, prefix));
}

export function matchedMainNavPath(pathname: string) {
  return MAIN_NAV_PATHS.find((prefix) => pathMatchesPrefix(pathname, prefix)) || null;
}
