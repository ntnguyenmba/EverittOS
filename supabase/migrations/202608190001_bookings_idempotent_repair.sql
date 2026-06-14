-- Idempotent booking schema repair for deployments missing prior migrations.
-- Safe to run multiple times in Supabase SQL Editor or via migration push.

create extension if not exists "pgcrypto";

create or replace function public.member_role_in_org(org_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.organization_members
  where organization_id = org_id and user_id = auth.uid() and active = true
  limit 1;
$$;

create or replace function public.can_manage_organization(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.member_role_in_org(org_id) in ('owner', 'admin', 'manager');
$$;

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id and user_id = auth.uid() and active = true
  );
$$;

create or replace function public.booking_schema_ready()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'bookings'
  )
  and exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'services'
  )
  and exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'staff_services'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'manual_service_name'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'workspace_id'
  );
$$;

alter table public.organizations add column if not exists booking_slug text;

create unique index if not exists organizations_booking_slug_idx
  on public.organizations (booking_slug)
  where booking_slug is not null;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workspace_id uuid references public.organizations (id) on delete cascade,
  name text not null,
  category text,
  description text,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  price_cents integer not null default 0 check (price_cents >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.services add column if not exists workspace_id uuid references public.organizations (id) on delete cascade;
update public.services set workspace_id = organization_id where workspace_id is null;

create index if not exists services_org_active_idx on public.services (organization_id, is_active);
create index if not exists services_workspace_active_idx on public.services (workspace_id, is_active);

create table if not exists public.staff_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workspace_id uuid references public.organizations (id) on delete cascade,
  worker_id uuid not null references public.workers (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (worker_id, service_id)
);

alter table public.staff_services add column if not exists workspace_id uuid references public.organizations (id) on delete cascade;
update public.staff_services set workspace_id = organization_id where workspace_id is null;

create index if not exists staff_services_org_idx on public.staff_services (organization_id);
create index if not exists staff_services_workspace_idx on public.staff_services (workspace_id);
create index if not exists staff_services_service_idx on public.staff_services (service_id);

create table if not exists public.staff_availability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workspace_id uuid references public.organizations (id) on delete cascade,
  worker_id uuid not null references public.workers (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  buffer_minutes integer not null default 0 check (buffer_minutes >= 0),
  max_bookings integer not null default 20 check (max_bookings > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.staff_availability add column if not exists workspace_id uuid references public.organizations (id) on delete cascade;
update public.staff_availability set workspace_id = organization_id where workspace_id is null;

create index if not exists staff_availability_worker_day_idx
  on public.staff_availability (worker_id, day_of_week, is_active);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workspace_id uuid references public.organizations (id) on delete cascade,
  service_id uuid references public.services (id) on delete restrict,
  worker_id uuid references public.workers (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  client_name text not null,
  client_email text,
  client_phone text,
  manual_service_name text,
  staff_name text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'pending', 'cancelled', 'completed', 'no-show')),
  source text not null default 'public_booking',
  notes text,
  google_calendar_event_id text,
  confirmation_sent_at timestamptz,
  staff_notified_at timestamptz,
  calendar_sync_error text,
  cancel_token text not null default encode(gen_random_bytes(16), 'hex'),
  reschedule_token text not null default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.bookings add column if not exists workspace_id uuid references public.organizations (id) on delete cascade;
alter table public.bookings add column if not exists manual_service_name text;
alter table public.bookings add column if not exists staff_name text;
alter table public.bookings add column if not exists confirmation_sent_at timestamptz;
alter table public.bookings add column if not exists staff_notified_at timestamptz;
alter table public.bookings add column if not exists calendar_sync_error text;

update public.bookings set workspace_id = organization_id where workspace_id is null;

alter table public.bookings alter column service_id drop not null;

alter table public.bookings drop constraint if exists bookings_service_or_manual_check;
alter table public.bookings add constraint bookings_service_or_manual_check
  check (service_id is not null or nullif(trim(manual_service_name), '') is not null);

create index if not exists bookings_org_starts_idx on public.bookings (organization_id, starts_at);
create index if not exists bookings_workspace_starts_idx on public.bookings (workspace_id, starts_at);
create index if not exists bookings_worker_starts_idx on public.bookings (worker_id, starts_at);
create index if not exists bookings_status_idx on public.bookings (organization_id, status);
create index if not exists bookings_workspace_status_idx on public.bookings (workspace_id, status);
create index if not exists bookings_customer_idx on public.bookings (customer_id);

create or replace function public.sync_booking_workspace_id()
returns trigger language plpgsql as $$
begin
  if new.workspace_id is null and new.organization_id is not null then
    new.workspace_id := new.organization_id;
  elsif new.organization_id is null and new.workspace_id is not null then
    new.organization_id := new.workspace_id;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_sync_workspace_id on public.bookings;
create trigger bookings_sync_workspace_id
  before insert or update on public.bookings
  for each row execute function public.sync_booking_workspace_id();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists services_touch_updated_at on public.services;
create trigger services_touch_updated_at
  before update on public.services for each row execute function public.touch_updated_at();

drop trigger if exists staff_availability_touch_updated_at on public.staff_availability;
create trigger staff_availability_touch_updated_at
  before update on public.staff_availability for each row execute function public.touch_updated_at();

drop trigger if exists bookings_touch_updated_at on public.bookings;
create trigger bookings_touch_updated_at
  before update on public.bookings for each row execute function public.touch_updated_at();

alter table public.services enable row level security;
alter table public.staff_services enable row level security;
alter table public.staff_availability enable row level security;
alter table public.bookings enable row level security;

drop policy if exists services_org_select on public.services;
drop policy if exists services_org_manage on public.services;
drop policy if exists services_workspace_select on public.services;
drop policy if exists services_workspace_manage on public.services;

create policy services_workspace_select on public.services
  for select using (public.is_org_member(coalesce(workspace_id, organization_id)));

create policy services_workspace_manage on public.services
  for all
  using (public.can_manage_organization(coalesce(workspace_id, organization_id)))
  with check (public.can_manage_organization(coalesce(workspace_id, organization_id)));

drop policy if exists staff_services_org_select on public.staff_services;
drop policy if exists staff_services_org_manage on public.staff_services;
drop policy if exists staff_services_workspace_select on public.staff_services;
drop policy if exists staff_services_workspace_manage on public.staff_services;

create policy staff_services_workspace_select on public.staff_services
  for select using (public.is_org_member(coalesce(workspace_id, organization_id)));

create policy staff_services_workspace_manage on public.staff_services
  for all
  using (public.can_manage_organization(coalesce(workspace_id, organization_id)))
  with check (public.can_manage_organization(coalesce(workspace_id, organization_id)));

drop policy if exists staff_availability_org_select on public.staff_availability;
drop policy if exists staff_availability_org_manage on public.staff_availability;
drop policy if exists staff_availability_workspace_select on public.staff_availability;
drop policy if exists staff_availability_workspace_manage on public.staff_availability;

create policy staff_availability_workspace_select on public.staff_availability
  for select using (public.is_org_member(coalesce(workspace_id, organization_id)));

create policy staff_availability_workspace_manage on public.staff_availability
  for all
  using (public.can_manage_organization(coalesce(workspace_id, organization_id)))
  with check (public.can_manage_organization(coalesce(workspace_id, organization_id)));

drop policy if exists bookings_org_select on public.bookings;
drop policy if exists bookings_org_manage on public.bookings;
drop policy if exists bookings_workspace_select on public.bookings;
drop policy if exists bookings_workspace_manage on public.bookings;

create policy bookings_workspace_select on public.bookings
  for select using (public.is_org_member(coalesce(workspace_id, organization_id)));

create policy bookings_workspace_manage on public.bookings
  for all
  using (public.can_manage_organization(coalesce(workspace_id, organization_id)))
  with check (public.can_manage_organization(coalesce(workspace_id, organization_id)));

comment on table public.staff_services is 'Worker-to-service assignments for booking (staff_services junction)';
comment on table public.bookings is 'Workspace appointments; organization_id and workspace_id refer to the same org';
