import { safeNextPath } from '@/lib/app-url';
import { defaultPathForRole } from '@/lib/role-routes';
import { isClientRole, isContractorRole, normalizeRole } from '@/lib/roles';

const ONBOARDING_EXEMPT_PREFIXES = [
  '/',
  '/onboarding',
  '/settings/account',
  '/settings/security',
  '/team/accept',
  '/portal',
  '/auth',
  '/forgot-password',
  '/reset-password',
  '/login',
  '/signup',
  '/api'
];

export function isOnboardingExemptPath(pathname: string): boolean {
  return ONBOARDING_EXEMPT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Whether an authenticated user should be sent to onboarding before other app pages. */
export function shouldRedirectToOnboarding(
  roleInput: string | null | undefined,
  onboardingCompleted: boolean | null | undefined,
  pathname: string
): boolean {
  if (onboardingCompleted) return false;
  if (isOnboardingExemptPath(pathname)) return false;

  const role = normalizeRole(roleInput);
  if (isClientRole(role) || isContractorRole(role)) return false;

  return true;
}

/** Landing path immediately after sign-in or when opening `/` while authenticated. */
export function postAuthRedirectPath(
  roleInput: string | null | undefined,
  next: string | null | undefined,
  onboardingCompleted: boolean | null | undefined
): string {
  const role = normalizeRole(roleInput);
  const nextPath = safeNextPath(next);

  if (shouldRedirectToOnboarding(role, onboardingCompleted, nextPath)) {
    return '/onboarding';
  }

  return defaultPathForRole(role, nextPath);
}
