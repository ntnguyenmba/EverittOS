import { appOrigin, authRoutes } from '@/lib/app-url';

/** Canonical Supabase Auth redirect targets (derived from NEXT_PUBLIC_APP_URL). */
export function productionAuthRedirects() {
  const base = appOrigin();
  return {
    confirmEmail: `${base}/confirm-email`,
    authCallback: `${base}/auth/callback`,
    resetPassword: `${base}/reset-password`,
    login: `${base}/login`
  };
}

/** Signup confirmation link target for Supabase Auth emails. */
export function confirmEmailRedirectUrl(next?: string | null): string {
  return authRoutes.confirmEmail(next);
}

/** Password reset link target for Supabase Auth emails. */
export function resetPasswordRedirectUrl(): string {
  return authRoutes.resetPassword();
}

/** OAuth and legacy auth callback target. */
export function authCallbackRedirectUrl(next?: string | null): string {
  return authRoutes.authCallback(next);
}

/** Redirect URLs to allow in Supabase Dashboard > Authentication > URL Configuration. */
export function supabaseAllowedRedirectUrls(): string[] {
  const base = appOrigin();
  return [
    `${base}/confirm-email`,
    `${base}/confirm-email/**`,
    `${base}/auth/callback`,
    `${base}/auth/callback/**`,
    `${base}/reset-password`,
    `${base}/reset-password/**`,
    `${base}/login`
  ];
}
