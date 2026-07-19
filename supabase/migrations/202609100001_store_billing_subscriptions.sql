-- Unified store + Stripe subscription records for cross-platform entitlements.
-- Stripe rows may continue to live in everittos_subscriptions; this table
-- normalizes Apple, Google Play, and optional Stripe mirrors for entitlement resolution.

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  platform text not null check (platform in ('stripe', 'apple', 'google', 'manual')),
  product_id text not null,
  plan text not null check (plan in ('free', 'pro', 'business', 'starter', 'growth', 'enterprise')),
  external_subscription_id text,
  original_transaction_id text,
  purchase_token text,
  status text not null default 'pending'
    check (status in (
      'active', 'trialing', 'pending', 'grace_period', 'billing_retry',
      'on_hold', 'paused', 'cancelled', 'expired', 'revoked', 'refunded'
    )),
  environment text,
  started_at timestamptz,
  expires_at timestamptz,
  cancelled_at timestamptz,
  revoked_at timestamptz,
  grace_period_expires_at timestamptz,
  auto_renews boolean,
  last_verified_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists billing_subscriptions_apple_original_uidx
  on public.billing_subscriptions (platform, original_transaction_id)
  where platform = 'apple' and original_transaction_id is not null;

create unique index if not exists billing_subscriptions_google_token_uidx
  on public.billing_subscriptions (platform, purchase_token)
  where platform = 'google' and purchase_token is not null;

create unique index if not exists billing_subscriptions_stripe_sub_uidx
  on public.billing_subscriptions (platform, external_subscription_id)
  where platform = 'stripe' and external_subscription_id is not null;

create index if not exists billing_subscriptions_org_idx
  on public.billing_subscriptions (organization_id);

create index if not exists billing_subscriptions_user_idx
  on public.billing_subscriptions (user_id);

create index if not exists billing_subscriptions_status_idx
  on public.billing_subscriptions (status);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('stripe', 'apple', 'google', 'manual')),
  event_id text not null,
  event_type text not null,
  organization_id uuid,
  subscription_id uuid references public.billing_subscriptions(id) on delete set null,
  payload jsonb,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (platform, event_id)
);

create table if not exists public.account_entitlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan text not null check (plan in ('free', 'pro', 'business', 'starter', 'growth', 'enterprise')),
  source text not null check (source in ('stripe', 'apple', 'google', 'manual', 'free')),
  status text not null,
  expires_at timestamptz,
  billing_subscription_id uuid references public.billing_subscriptions(id) on delete set null,
  last_resolved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

alter table public.billing_subscriptions enable row level security;
alter table public.billing_events enable row level security;
alter table public.account_entitlements enable row level security;

-- Service role / server writes only. Authenticated clients read their org entitlement.
drop policy if exists account_entitlements_select_member on public.account_entitlements;
create policy account_entitlements_select_member
  on public.account_entitlements
  for select
  to authenticated
  using (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

drop policy if exists billing_subscriptions_select_member on public.billing_subscriptions;
create policy billing_subscriptions_select_member
  on public.billing_subscriptions
  for select
  to authenticated
  using (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
    or user_id = auth.uid()
  );

comment on table public.billing_subscriptions is
  'Normalized Apple, Google Play, Stripe, and manual subscriptions. Server verifies before write.';
comment on table public.billing_events is
  'Idempotent store/webhook event log for Apple ASN, Google RTDN, and related billing events.';
comment on table public.account_entitlements is
  'Cached effective plan per organization, resolved server-side from verified subscriptions.';
