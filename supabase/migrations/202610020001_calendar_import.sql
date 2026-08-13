-- Generic calendar import: store private iCal/ICS subscription URLs server-side
-- and attach stable external identities to normal EverittOS jobs.

alter table public.jobs
  add column if not exists external_source text;

alter table public.jobs
  add column if not exists external_uid text;

alter table public.jobs
  add column if not exists external_last_modified timestamptz;

comment on column public.jobs.external_source is
  'Generic import source key, for example calendar_import. Not a provider-specific integration.';

comment on column public.jobs.external_uid is
  'Stable external event UID used for idempotent calendar imports.';

comment on column public.jobs.external_last_modified is
  'LAST-MODIFIED (or equivalent) from the external calendar event.';

create unique index if not exists jobs_external_source_uid_unique
  on public.jobs (
    organization_id,
    external_source,
    external_uid
  )
  where external_source is not null
    and external_uid is not null;

create index if not exists jobs_external_source_org_idx
  on public.jobs (organization_id, external_source)
  where external_source is not null;

create table if not exists public.calendar_import_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  label text not null default 'Calendar Import',
  feed_url text not null,
  sync_enabled boolean not null default true,
  default_customer_id uuid references public.customers (id) on delete set null,
  default_property_id uuid references public.customer_properties (id) on delete set null,
  default_revenue_amount numeric(12, 2),
  last_sync_at timestamptz,
  last_sync_error text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_import_connections_feed_url_https_check
    check (feed_url like 'https://%'),
  constraint calendar_import_connections_revenue_nonnegative_check
    check (default_revenue_amount is null or default_revenue_amount >= 0)
);

create index if not exists calendar_import_connections_org_idx
  on public.calendar_import_connections (organization_id);

create index if not exists calendar_import_connections_sync_idx
  on public.calendar_import_connections (sync_enabled, last_sync_at);

comment on table public.calendar_import_connections is
  'Private iCal/ICS subscription connections. Multiple feeds per organization are allowed. feed_url is a secret.';

comment on column public.calendar_import_connections.feed_url is
  'Private calendar subscription URL. Service-role server access only. Never expose to the browser.';

alter table public.calendar_import_connections enable row level security;

drop policy if exists calendar_import_connections_deny on public.calendar_import_connections;
create policy calendar_import_connections_deny on public.calendar_import_connections
  for all
  using (false)
  with check (false);

revoke all on table public.calendar_import_connections from anon, authenticated, public;
grant all on table public.calendar_import_connections to service_role;
