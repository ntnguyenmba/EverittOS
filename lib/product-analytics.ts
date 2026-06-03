import { supabase } from '@/lib/supabase';

export type ProductEventName =
  | 'signup'
  | 'company_created'
  | 'job_created'
  | 'customer_created'
  | 'report_generated'
  | 'photo_uploaded'
  | 'team_invited'
  | 'team_member_added'
  | 'subscription_upgraded'
  | 'onboarding_step';

export async function trackProductEvent(
  eventName: ProductEventName,
  organizationId?: string | null,
  metadata?: Record<string, unknown>
) {
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
