-- Idempotent Stripe webhook processing: one claim row per Stripe event id.
create unique index if not exists subscription_events_webhook_claim_unique
  on public.subscription_events (stripe_event_id)
  where event_type like 'webhook.claimed:%'
    and stripe_event_id is not null
    and stripe_event_id <> '';
