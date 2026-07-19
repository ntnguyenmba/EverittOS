-- Unified store + Stripe subscription records for cross-platform entitlements.
-- Stripe rows may continue to live in everittos_subscriptions; this table
-- normalizes Apple, Google Play, and optional Stripe mirrors for entitlement resolution.
--
-- This migration is intentionally additive because some EverittOS databases may
-- already contain a legacy public.billing_subscriptions table. CREATE TABLE IF
-- NOT EXISTS alone does not add missing columns to an existing table.

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  platform text not null default 'stripe',
  product_id text not null default 'legacy',
  plan text not null default 'free',
  external_subscription_id text,
  original_transaction_id text,
  purchase_token text,
  status text not null default 'pending',
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

-- Upgrade a legacy billing_subscriptions table in place.
alter table public.billing_subscriptions add column if not exists organization_id uuid;
alter table public.billing_subscriptions add column if not exists user_id uuid;
alter table public.billing_subscriptions add column if not exists platform text;
alter table public.billing_subscriptions add column if not exists product_id text;
alter table public.billing_subscriptions add column if not exists plan text;
alter table public.billing_subscriptions add column if not exists external_subscription_id text;
alter table public.billing_subscriptions add column if not exists original_transaction_id text;
alter table public.billing_subscriptions add column if not exists purchase_token text;
alter table public.billing_subscriptions add column if not exists status text;
alter table public.billing_subscriptions add column if not exists environment text;
alter table public.billing_subscriptions add column if not exists started_at timestamptz;
alter table public.billing_subscriptions add column if not exists expires_at timestamptz;
alter table public.billing_subscriptions add column if not exists cancelled_at timestamptz;
alter table public.billing_subscriptions add column if not exists revoked_at timestamptz;
alter table public.billing_subscriptions add column if not exists grace_period_expires_at timestamptz;
alter table public.billing_subscriptions add column if not exists auto_renews boolean;
alter table public.billing_subscriptions add column if not exists last_verified_at timestamptz;
alter table public.billing_subscriptions add column if not exists raw_payload jsonb;
alter table public.billing_subscriptions add column if not exists created_at timestamptz;
alter table public.billing_subscriptions add column if not exists updated_at timestamptz;

-- Existing records predate native billing and therefore default to Stripe/legacy.
update public.billing_subscriptions set platform = 'stripe' where platform is null;
update public.billing_subscriptions set product_id = 'legacy' where product_id is null;
update public.billing_subscriptions set plan = 'free' where plan is null;
update public.billing_subscriptions set status = 'pending' where status is null;
update public.billing_subscriptions set created_at = now() where created_at is null;
update public.billing_subscriptions set updated_at = now() where updated_at is null;

alter table public.billing_subscriptions alter column platform set default 'stripe';
alter table public.billing_subscriptions alter column platform set not null;
alter table public.billing_subscriptions alter column product_id set default 'legacy';
alter table public.billing_subscriptions alter column product_id set not null;
alter table public.billing_subscriptions alter column plan set default 'free';
alter table public.billing_subscriptions alter column plan set not null;
alter table public.billing_subscriptions alter column status set default 'pending';
alter table public.billing_subscriptions alter column status set not null;
alter table public.billing_subscriptions alter column created_at set default now();
alter table public.billing_subscriptions alter column created_at set not null;
alter table public.billing_subscriptions alter column updated_at set default now();
alter table public.billing_subscriptions alter column updated_at set not null;

-- Add foreign keys only when an equivalent named constraint is absent.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'billing_subscriptions_organization_id_fkey'
      and conrelid = 'public.billing_subscriptions'::regclass
  ) then
    alter table public.billing_subscriptions
      add constraint billing_subscriptions_organization_id_fkey
      foreign key (organization_id) references public.organizations(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'billing_subscriptions_user_id_fkey'
      and conrelid = 'public.billing_subscriptions'::regclass
  ) then
    alter table public.billing_subscriptions
      add constraint billing_subscriptions_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete set null;
  end if;
end $$;

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