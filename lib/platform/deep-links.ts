import { MOBILE_APP_SCHEME, MOBILE_DEEP_LINK_PATHS, MOBILE_PRODUCTION_HOST } from '@/lib/platform/config';
import { safeNextPath } from '@/lib/app-url';

const ALLOWED_PREFIXES = [
  ...MOBILE_DEEP_LINK_PATHS,
  '/login',
  '/signup',
  '/forgot-password',
  '/reports',
  '/invoices',
  '/expenses',
  '/photos',
  '/workflows',
  '/analytics',
  '/activity',
  '/admin',
  '/portal',
  '/team'
];

export type ParsedDeepLink =
  | { ok: true; path: string; search: string }
  | { ok: false; reason: string };

function isAllowedPath(pathname: string): boolean {
  if (!pathname.startsWith('/')) return false;
  return ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Parse custom scheme, universal, or app-relative deep links into a safe in-app path. */
export function parseDeepLink(rawUrl: string): ParsedDeepLink {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { ok: false, reason: 'empty_url' };

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol === `${MOBILE_APP_SCHEME}:`) {
      const path = `/${parsed.hostname}${parsed.pathname}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
      const normalized = safeNextPath(path, '/dashboard');
      if (!isAllowedPath(normalized)) return { ok: false, reason: 'path_not_allowed' };
      return { ok: true, path: normalized, search: parsed.search };
    }

    if (parsed.protocol === 'https:' && parsed.hostname === MOBILE_PRODUCTION_HOST) {
      const normalized = safeNextPath(parsed.pathname, '/dashboard');
      if (!isAllowedPath(normalized)) return { ok: false, reason: 'path_not_allowed' };
      return { ok: true, path: normalized, search: parsed.search };
    }

    if (trimmed.startsWith('/')) {
      const normalized = safeNextPath(trimmed.split('?')[0], '/dashboard');
      if (!isAllowedPath(normalized)) return { ok: false, reason: 'path_not_allowed' };
      const search = trimmed.includes('?') ? `?${trimmed.split('?').slice(1).join('?')}` : '';
      return { ok: true, path: normalized, search };
    }

    return { ok: false, reason: 'unsupported_origin' };
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
}

export function deepLinkToAppPath(rawUrl: string): string | null {
  const parsed = parseDeepLink(rawUrl);
  if (!parsed.ok) return null;
  return `${parsed.path}${parsed.search}`;
}

export function postLoginSafePath(next: string | null | undefined): string {
  const fallback = '/dashboard';
  const normalized = safeNextPath(next, fallback);
  if (normalized === '/login' || normalized === '/signup' || normalized.startsWith('/forgot-password')) {
    return fallback;
  }
  return normalized;
}
