import { createAdminSupabase } from '@/lib/supabase-admin';
import type { PromoValidationErrorCode } from '@/lib/stripe-promo';

export type PromoFailureStage = 'validate' | 'checkout';

export type PromoCodeFailureInput = {
  userId?: string | null;
  organizationId?: string | null;
  stage: PromoFailureStage;
  code: string;
  plan?: string | null;
  errorCode?: PromoValidationErrorCode | string;
  error: string;
};

/** Production-safe promo failure logging: structured console + product_events row. */
export async function logPromoCodeFailure(input: PromoCodeFailureInput): Promise<void> {
  const normalizedCode = input.code.trim().toUpperCase();
  const payload = {
    event: 'promo_code_failure',
    stage: input.stage,
    code: normalizedCode || null,
    plan: input.plan || null,
    errorCode: input.errorCode || 'invalid',
    error: input.error,
    userId: input.userId || null,
    organizationId: input.organizationId || null,
    ts: new Date().toISOString()
  };

  console.warn(`[everittos-billing] ${JSON.stringify(payload)}`);

  const admin = createAdminSupabase();
  if (!admin) return;

  await admin.from('product_events').insert({
    organization_id: input.organizationId || null,
    user_id: input.userId || null,
    event_name: 'billing_activity',
    metadata: {
      activity: 'promo_code_failure',
      stage: input.stage,
      code: normalizedCode || null,
      plan: input.plan || null,
      error_code: payload.errorCode,
      error: input.error
    }
  });
}
