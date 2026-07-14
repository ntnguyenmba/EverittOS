/** Deep-link and universal-link configuration for native wrappers. */
export const MOBILE_APP_SCHEME = 'everittos';

export const MOBILE_APP_CONFIG = {
  iosBundleId: 'com.everittventures.everittos',
  androidPackage: 'com.everittventures.everittos',
  productionHost: 'app.everittventures.com',
  customScheme: MOBILE_APP_SCHEME,
  /** Paths handled by the web app and native shells. */
  deepLinkPaths: [
    '/dashboard',
    '/jobs',
    '/customers',
    '/schedule',
    '/people',
    '/notifications',
    '/settings',
    '/onboarding',
    '/portal/client',
    '/portal/contractor',
    '/auth/callback',
    '/confirm-email',
    '/reset-password',
    '/team/accept',
    '/reports',
    '/invoices',
    '/expenses',
    '/photos'
  ]
} as const;
