/** Deep-link and universal-link configuration for future native wrappers. */
export const MOBILE_APP_CONFIG = {
  iosBundleId: 'com.everittventures.everittos',
  androidPackage: 'com.everittventures.everittos',
  /** Paths handled by the web app and future native shells. */
  deepLinkPaths: [
    '/dashboard',
    '/jobs',
    '/customers',
    '/schedule',
    '/workers',
    '/notifications',
    '/settings',
    '/onboarding',
    '/portal/client',
    '/portal/contractor',
    '/auth/callback',
    '/reset-password',
    '/team/accept'
  ]
} as const;
