/** Grep-friendly billing activation stage logs for Vercel function output. */
export type BillingPipelineStage =
  | 'checkout_started'
  | 'checkout_completed'
  | 'webhook_received'
  | 'webhook_verified'
  | 'customer_created'
  | 'subscription_found'
  | 'subscription_saved'
  | 'profile_updated'
  | 'workspace_updated'
  | 'plan_activated'
  | 'activation_failed';

export function logBillingPipeline(stage: BillingPipelineStage, data: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({
      billingPipeline: stage,
      at: new Date().toISOString(),
      ...data
    })
  );
}
