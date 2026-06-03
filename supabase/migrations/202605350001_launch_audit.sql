-- Launch audit: indexes, subscription tracking, platform health

create index if not exists jobs_organization_id_idx on public.jobs (organization_id);
create index if not exists customers_organization_id_idx on public.customers (organization_id);
create index if not exists job_photos_organization_id_idx on public.job_photos (organization_id);
create index if not exists job_reports_organization_id_idx on public.job_reports (organization_id);
create index if not exists activity_logs_created_at_idx on public.activity_logs (created_at desc);
create index if not exists product_events_event_name_idx on public.product_events (event_name);
create index if not exists organization_invitations_status_idx on public.organization_invitations (status);

alter table public.everittos_subscriptions
  add column if not exists cancelled_at timestamptz,
  add column if not exists last_payment_status text;

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  event_type text not null,
  plan text,
  stripe_event_id text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists subscription_events_email_idx on public.subscription_events (email);

alter table public.subscription_events enable row level security;

drop policy if exists subscription_events_admin on public.subscription_events;
create policy subscription_events_admin on public.subscription_events
  for select using (false);

-- Service role only inserts via webhook; no client select by default
