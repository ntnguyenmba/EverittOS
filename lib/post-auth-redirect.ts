import { safeNextPath } from '@/lib/app-url';
import { defaultPathForRole } from '@/lib/role-routes';
import { isClientRole, isContractorRole, normalizeRole } from '@/lib/roles';

const ONBOARDING_EXEMPT_PREFIXES = [
  '/',
  '/dashboard',
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

/** Whether middleware should block app routes until onboarding completes. Always false — onboarding is optional. */
export function shouldRedirectToOnboarding(
  _roleInput: string | null | undefined,
  _onboardingCompleted: boolean | null | undefined,
  _pathname: string
): boolean {
  return false;
}

/** Suggest onboarding after sign-in when setup is incomplete and not skipped. */
export function shouldSuggestOnboarding(
  roleInput: string | null | undefined,
  onboardingCompleted: boolean | null | undefined,
  onboardingSkipped: boolean | null | undefined
): boolean {
  if (onboardingCompleted || onboardingSkipped) return false;
  const role = normalizeRole(roleInput);
  if (isClientRole(role) || isContractorRole(role)) return false;
  return true;
}

/** Landing path immediately after sign-in or when opening `/` while authenticated. */
export function postAuthRedirectPath(
  roleInput: string | null | undefined,
  next: string | null | undefined,
  onboardingCompleted: boolean | null | undefined,
  onboardingSkipped?: boolean | null | undefined
): string {
  const role = normalizeRole(roleInput);
  const nextPath = safeNextPath(next);

  if (shouldSuggestOnboarding(role, onboardingCompleted, onboardingSkipped)) {
    if (nextPath === '/dashboard' || nextPath === '/' || nextPath === '/onboarding') {
      return '/onboarding';
    }
  }

  return defaultPathForRole(role, nextPath);
}
