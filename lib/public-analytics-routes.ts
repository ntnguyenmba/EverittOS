/** Routes that may load Google Analytics (signup only; marketing site handles public analytics). */
export const GA_PUBLIC_PATHS = new Set(['/signup']);

export function isPublicAnalyticsPath(pathname: string): boolean {
  const base = pathname.split('?')[0].replace(/\/$/, '') || '/';
  return GA_PUBLIC_PATHS.has(base);
}
