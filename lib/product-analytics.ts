import { analyticsAllowed } from '@/lib/cookie-consent';
import { supabase } from '@/lib/supabase';

export type ProductEventName =
  | 'signup'
  | 'login'
  | 'logout'
  | 'company_created'
  | 'job_created'
  | 'customer_created'
  | 'lead_created'
  | 'worker_created'
  | 'appointment_scheduled'
  | 'worker_invited'
  | 'report_generated'
  | 'photo_uploaded'
  | 'team_invited'
  | 'team_member_added'
  | 'subscription_started'
  | 'subscription_cancelled'
  | 'subscription_upgraded'
  | 'onboarding_step'
  | 'onboarding_started'
  | 'onboarding_step_completed'
  | 'onboarding_step_skipped'
  | 'onboarding_completed'
  | 'onboarding_abandoned'
  | 'client_portal_view'
  | 'billing_activity'
  | 'feature_adoption';

const CONSENT_GATED_EVENTS = new Set<ProductEventName>([
  'onboarding_started',
  'onboarding_step_completed',
  'onboarding_step_skipped',
  'onboarding_completed',
  'onboarding_abandoned',
  'feature_adoption',
  'client_portal_view'
]);

export async function trackProductEvent(
  eventName: ProductEventName,
  organizationId?: string | null,
  metadata?: Record<string, unknown>
) {
  if (typeof window !== 'undefined' && CONSENT_GATED_EVENTS.has(eventName) && !analyticsAllowed()) {
    return;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  await supabase.from('product_events').insert({
    organization_id: organizationId || null,
    user_id: user?.id || null,
    event_name: eventName,
    metadata: metadata || {}
  });
}
