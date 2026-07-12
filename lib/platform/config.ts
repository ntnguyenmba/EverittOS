import { MOBILE_APP_CONFIG } from '@/lib/mobile-app-config';
import { PRODUCTION_APP_ORIGIN } from '@/lib/app-url';

export const MOBILE_APP_SCHEME = 'everittos';

export const MOBILE_PRODUCTION_HOST = 'app.everittventures.com';

export const MOBILE_TRUSTED_HOSTS = [
  MOBILE_PRODUCTION_HOST,
  'everittventures.com',
  'www.everittventures.com'
] as const;

export const MOBILE_NATIVE_IDENTIFIERS = {
  iosBundleId: MOBILE_APP_CONFIG.iosBundleId,
  androidPackage: MOBILE_APP_CONFIG.androidPackage
} as const;

export const MOBILE_DEEP_LINK_PATHS = MOBILE_APP_CONFIG.deepLinkPaths;

export function mobileProductionOrigin(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_APP_URL || process.env.CAPACITOR_SERVER_URL || '').replace(/\/$/, '');
  if (fromEnv.startsWith('https://')) return fromEnv;
  return PRODUCTION_APP_ORIGIN;
}
