export {
  ONBOARDING_STEP_COUNT,
  onboardingDismissStorageKey,
  onboardingProgressPercent,
  shouldShowOnboardingChecklist
} from '@/lib/onboarding/constants';

/** @deprecated Use i18n onboarding.checklist.steps */
export const ONBOARDING_STEP_LABELS = [
  'Welcome',
  'Business profile',
  'Operations',
  'Team invites',
  'Calendar',
  'First job',
  'Complete'
] as const;
