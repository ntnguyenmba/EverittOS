import { trackProductEvent } from '@/lib/product-analytics';
import { logAuthEvent } from '@/lib/auth-logger';

export async function trackOnboardingStarted(organizationId: string) {
  await trackProductEvent('onboarding_started', organizationId);
}

export async function trackOnboardingStepCompleted(
  organizationId: string,
  step: number,
  metadata?: Record<string, unknown>
) {
  await trackProductEvent('onboarding_step_completed', organizationId, { step, ...metadata });
}

export async function trackOnboardingStepSkipped(
  organizationId: string,
  step: number,
  metadata?: Record<string, unknown>
) {
  await trackProductEvent('onboarding_step_skipped', organizationId, { step, ...metadata });
}

export async function trackOnboardingCompleted(
  organizationId: string,
  metadata?: Record<string, unknown>
) {
  logAuthEvent('onboarding_completed', {
    organizationId,
    skipped: metadata?.skipped ? 1 : 0
  });
  await trackProductEvent('onboarding_completed', organizationId, metadata);
}

export async function trackOnboardingAbandoned(
  organizationId: string,
  step: number,
  metadata?: Record<string, unknown>
) {
  await trackProductEvent('onboarding_abandoned', organizationId, { step, ...metadata });
}
