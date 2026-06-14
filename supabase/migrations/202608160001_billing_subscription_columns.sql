-- Extend everittos_subscriptions for Stripe webhook sync fields.

alter table public.everittos_subscriptions
  add column if not exists stripe_price_id text,
  add column if not exists cancel_at_period_end boolean default false,
  add column if not exists organization_id uuid references public.organizations (id) on delete set null;

create index if not exists everittos_subscriptions_user_id_idx
  on public.everittos_subscriptions (user_id);

create index if not exists everittos_subscriptions_organization_id_idx
  on public.everittos_subscriptions (organization_id);

comment on column public.everittos_subscriptions.stripe_price_id is 'Stripe price ID for the active subscription item';
comment on column public.everittos_subscriptions.cancel_at_period_end is 'True when subscription is set to cancel at period end';
