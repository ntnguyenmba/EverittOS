/** Production EverittOS origin (fallback when NEXT_PUBLIC_APP_URL is unset on server). */
export const PRODUCTION_APP_ORIGIN = 'https://app.everittventures.com';

export function safeNextPath(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback;
  return next;
}

/** Application origin without trailing slash. Always prefers NEXT_PUBLIC_APP_URL. */
export function appOrigin(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return PRODUCTION_APP_ORIGIN;
}

/** Absolute URL for an in-app path. Never hardcode deployment hosts. */
export function appUrl(path = ''): string {
  const normalized = path.startsWith('/') ? path : path ? `/${path}` : '';
  return `${appOrigin()}${normalized}`;
}

/** Canonical auth route URLs derived from NEXT_PUBLIC_APP_URL. */
export const authRoutes = {
  login: () => appUrl('/login'),
  signup: () => appUrl('/signup'),
  forgotPassword: () => appUrl('/forgot-password'),
  resetPassword: () => appUrl('/reset-password'),
  confirmEmail: (next?: string | null) => {
    const destination = safeNextPath(next, '/onboarding');
    return appUrl(`/confirm-email?next=${encodeURIComponent(destination)}`);
  },
  authCallback: (next?: string | null) => {
    const destination = safeNextPath(next, '/onboarding');
    return appUrl(`/auth/callback?next=${encodeURIComponent(destination)}`);
  },
  dashboard: () => appUrl('/dashboard')
} as const;
