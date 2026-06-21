/** Structured activation logs for Vercel function output (grep-friendly). */
export function logBillingActivation(
  tag:
    | 'WEBHOOK_RECEIVED'
    | 'WEBHOOK_SYNC_SUCCESS'
    | 'WEBHOOK_SYNC_FAILED'
    | 'CHECKOUT_RETURN_SYNC'
    | 'CHECKOUT_RETURN_SYNC_FAILED',
  data: Record<string, unknown> = {}
) {
  console.log(tag, data);
}
