/** Primary marketing site (pricing, product overview, industries). */
export const MARKETING_SITE_URL = 'https://everittventures.com/tech';

/** App routes removed in favor of the marketing site. */
export const LEGACY_MARKETING_APP_PATHS = new Set(['/product', '/pricing', '/industries']);

export function isLegacyMarketingAppPath(pathname: string): boolean {
  const base = pathname.split('?')[0].replace(/\/$/, '') || '/';
  return LEGACY_MARKETING_APP_PATHS.has(base);
}
