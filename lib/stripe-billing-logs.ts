const LOG_SCOPE = 'stripe-billing';

export type StripeBillingLogTag =
  | 'checkout:unauthenticated'
  | 'checkout:forbidden'
  | 'checkout:invalid_plan'
  | 'checkout:missing_email'
  | 'checkout:already_subscribed'
  | 'checkout:not_configured'
  | 'checkout:promo_invalid'
  | 'checkout:session_created'
  | 'checkout:session_create_failed'
  | 'webhook:missing_signature'
  | 'webhook:signature_invalid'
  | 'webhook:received'
  | 'webhook:unhandled_type'
  | 'webhook:handler_error'
  | 'webhook:checkout_completed'
  | 'webhook:subscription_event'
  | 'webhook:subscription_deleted'
  | 'webhook:invoice_event'
  | 'sync:completed'
  | 'sync:issue';

export type StripeBillingLogLevel = 'log' | 'warn' | 'error';

export function logStripeBilling(
  tag: StripeBillingLogTag,
  data: Record<string, unknown> = {},
  level: StripeBillingLogLevel = 'log'
) {
  const payload = {
    scope: LOG_SCOPE,
    tag,
    at: new Date().toISOString(),
    ...data
  };
  const line = JSON.stringify(payload);

  if (level === 'warn') {
    console.warn(line);
    return;
  }
  if (level === 'error') {
    console.error(line);
    return;
  }
  console.log(line);
}

/** Back-compat wrapper for existing billing sync call sites. */
export function logBillingSyncEvent(eventType: string, data: Record<string, unknown>) {
  logStripeBilling('sync:completed', { eventType, ...data });
}

export function logBillingSyncIssueEvent(issue: string, data: Record<string, unknown>) {
  logStripeBilling('sync:issue', { issue, ...data }, 'warn');
}
