/** Production EverittOS origin (used when env is unset on server). */
export const PRODUCTION_APP_ORIGIN = 'https://everitt-os.vercel.app';

export function safeNextPath(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback;
  return next;
}

export function appUrl(path = ''): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : PRODUCTION_APP_ORIGIN)
  ).replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}
