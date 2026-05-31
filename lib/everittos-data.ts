import { supabase } from '@/lib/supabase';
import { normalizedPlan } from '@/lib/everittos-access';
import type { BillingProfile, BillingSubscription } from '@/lib/everittos-access';

export async function loadBillingContext(userId: string) {
  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from('profiles').select('plan, subscription_status, role').eq('id', userId).maybeSingle(),
    supabase
      .from('everittos_subscriptions')
      .select('status, plan, current_period_end')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  return {
    plan: normalizedPlan(profile as BillingProfile | null),
    profile: profile as (BillingProfile & { role?: string | null }) | null,
    subscription: subscription as BillingSubscription | null
  };
}

export async function appendJobTimeline(jobId: string, userId: string, eventType: string, message: string) {
  await supabase.from('job_timeline').insert({
    job_id: jobId,
    user_id: userId,
    event_type: eventType,
    message
  });
}
