export const ONBOARDING_STEP_COUNT = 7;

export const INDUSTRY_OPTIONS = [
  'property_management',
  'cleaning',
  'maintenance',
  'construction',
  'landscaping',
  'field_service',
  'hospitality',
  'other'
] as const;

export const TEAM_SIZE_OPTIONS = ['solo', 'small', 'medium', 'large', 'enterprise'] as const;

export const OPERATIONS_OPTIONS = [
  'jobs',
  'properties',
  'customers',
  'contractors',
  'workers',
  'maintenance',
  'cleaning',
  'inspections',
  'other'
] as const;

export const INVITE_ROLE_OPTIONS = ['admin', 'manager', 'worker'] as const;

export type IndustryOption = (typeof INDUSTRY_OPTIONS)[number];
export type TeamSizeOption = (typeof TEAM_SIZE_OPTIONS)[number];
export type OperationsOption = (typeof OPERATIONS_OPTIONS)[number];
export type InviteRoleOption = (typeof INVITE_ROLE_OPTIONS)[number];

export type TeamInviteRow = {
  email: string;
  role: InviteRoleOption;
};

export function onboardingProgressPercent(step: number, completed: boolean): number {
  if (completed) return 100;
  const clamped = Math.max(0, Math.min(step, ONBOARDING_STEP_COUNT));
  return Math.round((clamped / ONBOARDING_STEP_COUNT) * 100);
}

export function onboardingDismissStorageKey(organizationId: string): string {
  return `everittos_onboarding_dismissed_${organizationId}`;
}

export function shouldShowOnboardingChecklist(options: {
  organizationId: string | null;
  onboardingCompleted: boolean;
  onboardingSkipped: boolean;
  dismissed: boolean;
}): boolean {
  if (!options.organizationId) return false;
  if (options.onboardingCompleted || options.onboardingSkipped) return false;
  if (options.dismissed) return false;
  return true;
}
