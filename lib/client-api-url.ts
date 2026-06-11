import { appUrl } from '@/lib/app-url';

/** Resolve an app API path to an absolute URL in the browser (fixes relative fetch on custom domains). */
export function resolveClientApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin.replace(/\/$/, '')}${normalized}`;
  }
  return appUrl(normalized);
}
