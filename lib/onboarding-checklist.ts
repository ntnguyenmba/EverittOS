export const ONBOARDING_STEP_COUNT = 6;

export const ONBOARDING_STEP_LABELS = [
  'Set up your workspace (optional)',
  'Add your first customer',
  'Create your first job',
  'Upload your first photo',
  'Generate your first report',
  'Invite a team member (optional)'
] as const;

export function onboardingDismissStorageKey(organizationId: string): string {
  return `everittos_onboarding_dismissed_${organizationId}`;
}

export function onboardingProgressPercent(step: number, completed: boolean): number {
  if (completed) return 100;
  return Math.round((Math.max(0, Math.min(step, ONBOARDING_STEP_COUNT)) / ONBOARDING_STEP_COUNT) * 100);
}

export function shouldShowOnboardingChecklist(options: {
  organizationId: string | null;
  onboardingCompleted: boolean;
  dismissed: boolean;
}): boolean {
  if (!options.organizationId) return false;
  if (options.onboardingCompleted) return false;
  if (options.dismissed) return false;
  return true;
}
