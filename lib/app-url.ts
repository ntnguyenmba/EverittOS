import { sanitizeBillingEnvValue } from '@/lib/billing-env';

/** Production EverittOS origin (fallback when NEXT_PUBLIC_APP_URL is unset on server). */
export const PRODUCTION_APP_ORIGIN = 'https://app.everittventures.com';

const APP_URL_ENV_KEYS = ['NEXT_PUBLIC_APP_URL', 'APP_URL', 'NEXT_PUBLIC_SITE_URL'] as const;

export function safeNextPath(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback;
  return next;
}

/** Raw app URL env values (for checkout diagnostics — detects quotes/whitespace before sanitization). */
export function rawAppUrlEnvValues(): Record<(typeof APP_URL_ENV_KEYS)[number], string | undefined> {
  return {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    APP_URL: process.env.APP_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL
  };
}

function resolveAppOriginFromEnv(): string | null {
  for (const key of APP_URL_ENV_KEYS) {
    const sanitized = sanitizeBillingEnvValue(process.env[key]);
    if (sanitized) return sanitized.replace(/\/$/, '');
  }
  return null;
}

/** Application origin without trailing slash. Prefers sanitized NEXT_PUBLIC_APP_URL, then APP_URL, then SITE_URL. */
export function appOrigin(): string {
  const fromEnv = resolveAppOriginFromEnv();
  if (fromEnv) return fromEnv;

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
