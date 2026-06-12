/** Production support contact for mailto links and account help. */
export const SUPPORT_EMAIL = 'team@everittventures.com';

export function supportMailtoHref(subject = 'EverittOS support'): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

export const ONBOARDING_CALL_SUBJECT = 'EverittOS Free 30-Minute Onboarding Call';

/** Mailto for booking a free onboarding / SOP / training call. */
export function onboardingCallMailtoHref(): string {
  return supportMailtoHref(ONBOARDING_CALL_SUBJECT);
}

export const LEGAL_NOTICE =
  'These policies are provided for early-stage operations and are not attorney-reviewed. Consult qualified legal counsel before a public launch.';
