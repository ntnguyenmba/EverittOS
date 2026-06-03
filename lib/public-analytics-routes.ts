/** Routes that may load Google Analytics (public marketing only). */
export const GA_PUBLIC_PATHS = new Set(['/', '/pricing', '/product', '/signup']);

export function isPublicAnalyticsPath(pathname: string): boolean {
  const base = pathname.split('?')[0].replace(/\/$/, '') || '/';
  return GA_PUBLIC_PATHS.has(base);
}
