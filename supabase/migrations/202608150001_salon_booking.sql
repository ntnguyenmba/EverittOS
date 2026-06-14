-- Salon booking: services, staff assignment, availability, bookings, org booking slug

alter table public.organizations
  add column if not exists booking_slug text;

create unique index if not exists organizations_booking_slug_idx
  on public.organizations (booking_slug)
  where booking_slug is not null;

-- Backfill slug from organization name
update public.organizations o
set booking_slug = sub.slug
from (
  select
    id,
    trim(both '-' from regexp_replace(lower(coalesce(name, 'workspace')), '[^a-z0-9]+', '-', 'g')) as slug
  from public.organizations
  where booking_slug is null
) sub
where o.id = sub.id and o.booking_slug is null;

update public.organizations
set booking_slug = 'workspace-' || left(replace(id::text, '-', ''), 8)
where booking_slug is null or booking_slug = '';

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  category text,
  description text,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  price_cents integer not null default 0 check (price_cents >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists services_org_active_idx on public.services (organization_id, is_active);

create table if not exists public.staff_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  worker_id uuid not null references public.workers (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (worker_id, service_id)
);

create index if not exists staff_services_org_idx on public.staff_services (organization_id);
create index if not exists staff_services_service_idx on public.staff_services (service_id);

create table if not exists public.staff_availability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
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

create index if not exists staff_availability_worker_day_idx
  on public.staff_availability (worker_id, day_of_week, is_active);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  worker_id uuid references public.workers (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  client_name text not null,
  client_email text,
  client_phone text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'pending', 'cancelled', 'completed', 'no-show')),
  source text not null default 'public_booking',
  notes text,
  google_calendar_event_id text,
  cancel_token text not null default encode(gen_random_bytes(16), 'hex'),
  reschedule_token text not null default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists bookings_org_starts_idx on public.bookings (organization_id, starts_at);
create index if not exists bookings_worker_starts_idx on public.bookings (worker_id, starts_at);
create index if not exists bookings_status_idx on public.bookings (organization_id, status);

-- updated_at triggers
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

-- RLS
alter table public.services enable row level security;
alter table public.staff_services enable row level security;
alter table public.staff_availability enable row level security;
alter table public.bookings enable row level security;

drop policy if exists services_org_select on public.services;
create policy services_org_select on public.services for select using (public.is_org_member(organization_id));

drop policy if exists services_org_manage on public.services;
create policy services_org_manage on public.services for all using (public.can_manage_organization(organization_id));

drop policy if exists staff_services_org_select on public.staff_services;
create policy staff_services_org_select on public.staff_services for select using (public.is_org_member(organization_id));

drop policy if exists staff_services_org_manage on public.staff_services;
create policy staff_services_org_manage on public.staff_services for all using (public.can_manage_organization(organization_id));

drop policy if exists staff_availability_org_select on public.staff_availability;
create policy staff_availability_org_select on public.staff_availability for select using (public.is_org_member(organization_id));

drop policy if exists staff_availability_org_manage on public.staff_availability;
create policy staff_availability_org_manage on public.staff_availability for all using (public.can_manage_organization(organization_id));

drop policy if exists bookings_org_select on public.bookings;
create policy bookings_org_select on public.bookings for select using (public.is_org_member(organization_id));

drop policy if exists bookings_org_manage on public.bookings;
create policy bookings_org_manage on public.bookings for all using (public.can_manage_organization(organization_id));
