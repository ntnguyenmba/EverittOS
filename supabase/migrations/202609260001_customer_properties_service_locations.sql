-- First-class customer properties / service locations + timezone support.
-- Idempotent and safe to re-run. Preserves existing address columns and jobs.

-- ---------------------------------------------------------------------------
-- 1) Ensure jobs timezone + property linkage columns exist
-- ---------------------------------------------------------------------------
alter table public.jobs
  add column if not exists timezone text;

alter table public.jobs
  add column if not exists property_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_property_id_fkey'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_property_id_fkey
      foreign key (property_id) references public.customer_properties (id) on delete set null;
  end if;
exception
  when undefined_table then
    null;
end $$;

create index if not exists jobs_organization_timezone_idx
  on public.jobs (organization_id, timezone);

create index if not exists jobs_property_id_idx
  on public.jobs (property_id);

-- ---------------------------------------------------------------------------
-- 2) Expand customer_properties into full service-location records
-- ---------------------------------------------------------------------------
alter table public.customer_properties
  add column if not exists property_type text,
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists county text,
  add column if not exists state text,
  add column if not exists state_code text,
  add column if not exists postal_code text,
  add column if not exists country text,
  add column if not exists country_code text,
  add column if not exists formatted_address text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists timezone text,
  add column if not exists access_instructions text,
  add column if not exists gate_code text,
  add column if not exists lockbox_code text,
  add column if not exists parking_instructions text,
  add column if not exists pet_notes text,
  add column if not exists supply_notes text,
  add column if not exists internal_notes text,
  add column if not exists default_price numeric(12, 2),
  add column if not exists default_duration_minutes integer,
  add column if not exists default_checklist_id uuid,
  add column if not exists preferred_contractor_id uuid,
  add column if not exists preferred_team_id uuid,
  add column if not exists is_primary boolean not null default false,
  add column if not exists is_archived boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

-- Keep legacy `address` / `notes` populated for compatibility.
update public.customer_properties
set formatted_address = coalesce(nullif(btrim(formatted_address), ''), nullif(btrim(address), ''))
where formatted_address is null
  and address is not null
  and btrim(address) <> '';

update public.customer_properties
set address_line_1 = coalesce(nullif(btrim(address_line_1), ''), nullif(btrim(address), ''))
where address_line_1 is null
  and address is not null
  and btrim(address) <> '';

update public.customer_properties
set property_type = coalesce(nullif(btrim(property_type), ''), 'home')
where property_type is null or btrim(property_type) = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_properties_property_type_check'
      and conrelid = 'public.customer_properties'::regclass
  ) then
    alter table public.customer_properties
      add constraint customer_properties_property_type_check
      check (
        property_type is null
        or lower(property_type) in ('home', 'airbnb', 'rental', 'office', 'commercial', 'other')
      );
  end if;
end $$;

create or replace function public.is_valid_timezone_name(value text)
returns boolean
language sql
stable
as $$
  select value is not null
    and btrim(value) <> ''
    and exists (
      select 1
      from pg_timezone_names
      where name = btrim(value)
    );
$$;

alter table public.customer_properties
  drop constraint if exists customer_properties_timezone_valid_check;

alter table public.customer_properties
  add constraint customer_properties_timezone_valid_check
  check (timezone is null or public.is_valid_timezone_name(timezone));

alter table public.jobs
  drop constraint if exists jobs_timezone_valid_check;

alter table public.jobs
  add constraint jobs_timezone_valid_check
  check (timezone is null or public.is_valid_timezone_name(timezone));

create index if not exists customer_properties_org_customer_idx
  on public.customer_properties (organization_id, customer_id);

create index if not exists customer_properties_org_active_idx
  on public.customer_properties (organization_id, is_archived, is_primary);

create index if not exists customer_properties_formatted_address_idx
  on public.customer_properties (organization_id, lower(formatted_address));

-- Allow inserts that omit user_id (default to auth.uid()).
alter table public.customer_properties
  alter column user_id drop not null;

create or replace function public.customer_properties_set_defaults()
returns trigger
language plpgsql
security invoker
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  if new.property_type is null or btrim(new.property_type) = '' then
    new.property_type := 'home';
  end if;
  if new.formatted_address is null or btrim(new.formatted_address) = '' then
    new.formatted_address := nullif(btrim(coalesce(new.address, '')), '');
  end if;
  if new.address is null or btrim(new.address) = '' then
    new.address := nullif(btrim(coalesce(new.formatted_address, '')), '');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists customer_properties_set_defaults_trg on public.customer_properties;
create trigger customer_properties_set_defaults_trg
  before insert or update on public.customer_properties
  for each row
  execute function public.customer_properties_set_defaults();

-- ---------------------------------------------------------------------------
-- 3) RLS: managers manage; contractors see assigned-job properties only
-- ---------------------------------------------------------------------------
alter table public.customer_properties enable row level security;

drop policy if exists customer_properties_org on public.customer_properties;
drop policy if exists customer_properties_select on public.customer_properties;
drop policy if exists customer_properties_write on public.customer_properties;

create policy customer_properties_select on public.customer_properties
  for select using (
    public.can_manage_organization(organization_id)
    or (
      public.is_org_member(organization_id)
      and exists (
        select 1
        from public.jobs j
        where j.property_id = customer_properties.id
          and public.is_assigned_to_job(j.id)
      )
    )
    or exists (
      select 1
      from public.jobs j
      join public.job_client_access jca on jca.job_id = j.id
      where j.property_id = customer_properties.id
        and jca.client_user_id = auth.uid()
    )
  );

create policy customer_properties_write on public.customer_properties
  for all using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));

-- ---------------------------------------------------------------------------
-- 4) Backfill properties from existing customer addresses (high confidence)
-- ---------------------------------------------------------------------------
with customer_address_source as (
  select
    c.id as customer_id,
    c.organization_id,
    c.user_id,
    coalesce(
      nullif(btrim(c.service_address), ''),
      nullif(btrim(c.property_address), ''),
      nullif(
        btrim(
          concat_ws(
            ', ',
            nullif(btrim(c.address_line1), ''),
            nullif(btrim(c.address_line2), ''),
            nullif(btrim(c.city), ''),
            nullif(btrim(c.state), ''),
            nullif(btrim(c.postal_code), ''),
            nullif(btrim(c.country), '')
          )
        ),
        ''
      )
    ) as formatted_address,
    nullif(btrim(c.address_line1), '') as address_line_1,
    nullif(btrim(c.address_line2), '') as address_line_2,
    nullif(btrim(c.city), '') as city,
    nullif(btrim(c.state), '') as state,
    nullif(btrim(c.postal_code), '') as postal_code,
    nullif(btrim(c.country), '') as country
  from public.customers c
  where c.organization_id is not null
),
candidates as (
  select *
  from customer_address_source
  where formatted_address is not null
),
missing as (
  select c.*
  from candidates c
  where not exists (
    select 1
    from public.customer_properties p
    where p.customer_id = c.customer_id
      and p.organization_id = c.organization_id
      and lower(btrim(coalesce(p.formatted_address, p.address, ''))) = lower(btrim(c.formatted_address))
  )
  and not exists (
    select 1
    from public.customer_properties p
    where p.customer_id = c.customer_id
      and p.organization_id = c.organization_id
      and p.is_primary = true
      and p.is_archived = false
  )
)
insert into public.customer_properties (
  organization_id,
  customer_id,
  user_id,
  name,
  property_type,
  address,
  address_line_1,
  address_line_2,
  city,
  state,
  postal_code,
  country,
  formatted_address,
  is_primary,
  is_archived
)
select
  m.organization_id,
  m.customer_id,
  m.user_id,
  'Primary',
  'home',
  m.formatted_address,
  coalesce(m.address_line_1, m.formatted_address),
  m.address_line_2,
  m.city,
  m.state,
  m.postal_code,
  m.country,
  m.formatted_address,
  true,
  false
from missing m;

-- ---------------------------------------------------------------------------
-- 5) Backfill job.property_id when address uniquely matches a customer property
-- ---------------------------------------------------------------------------
with job_matches as (
  select
    j.id as job_id,
    p.id as property_id,
    p.timezone as property_timezone
  from public.jobs j
  join public.customer_properties p
    on p.organization_id = j.organization_id
   and p.customer_id = j.customer_id
   and j.customer_id is not null
   and j.property_id is null
   and nullif(btrim(j.address), '') is not null
   and lower(btrim(coalesce(p.formatted_address, p.address, ''))) = lower(btrim(j.address))
)
update public.jobs j
set
  property_id = m.property_id,
  timezone = coalesce(nullif(btrim(j.timezone), ''), m.property_timezone)
from job_matches m
where j.id = m.job_id;

-- Create properties from unique job addresses when the job has a customer but no match.
with job_address_candidates as (
  select distinct on (j.organization_id, j.customer_id, lower(btrim(j.address)))
    j.organization_id,
    j.customer_id,
    j.user_id,
    btrim(j.address) as formatted_address,
    j.timezone
  from public.jobs j
  where j.customer_id is not null
    and j.property_id is null
    and j.organization_id is not null
    and nullif(btrim(j.address), '') is not null
    and not exists (
      select 1
      from public.customer_properties p
      where p.customer_id = j.customer_id
        and p.organization_id = j.organization_id
        and lower(btrim(coalesce(p.formatted_address, p.address, ''))) = lower(btrim(j.address))
    )
  order by j.organization_id, j.customer_id, lower(btrim(j.address)), j.created_at asc nulls last
),
inserted as (
  insert into public.customer_properties (
    organization_id,
    customer_id,
    user_id,
    name,
    property_type,
    address,
    address_line_1,
    formatted_address,
    timezone,
    is_primary,
    is_archived
  )
  select
    c.organization_id,
    c.customer_id,
    c.user_id,
    left(c.formatted_address, 80),
    'home',
    c.formatted_address,
    c.formatted_address,
    c.formatted_address,
    case
      when c.timezone is not null and public.is_valid_timezone_name(c.timezone) then c.timezone
      else null
    end,
    false,
    false
  from job_address_candidates c
  returning id, organization_id, customer_id, formatted_address, timezone
)
update public.jobs j
set
  property_id = i.id,
  timezone = coalesce(nullif(btrim(j.timezone), ''), i.timezone)
from inserted i
where j.organization_id = i.organization_id
  and j.customer_id = i.customer_id
  and j.property_id is null
  and lower(btrim(coalesce(j.address, ''))) = lower(btrim(i.formatted_address));

comment on table public.customer_properties is
  'Service locations / properties belonging to a customer. Jobs snapshot address fields and link via property_id.';

comment on column public.customer_properties.gate_code is
  'Sensitive access code. Never expose in public links, search previews, or notifications.';

comment on column public.customer_properties.lockbox_code is
  'Sensitive access code. Never expose in public links, search previews, or notifications.';

notify pgrst, 'reload schema';
