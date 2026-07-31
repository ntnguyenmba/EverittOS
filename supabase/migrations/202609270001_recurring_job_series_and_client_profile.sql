-- Recurring job series + client profile fields.
-- Idempotent. Preserves existing customers and one-time jobs.

-- ---------------------------------------------------------------------------
-- 1) Client profile completeness (prefer existing columns; add only missing)
-- ---------------------------------------------------------------------------
alter table public.customers
  add column if not exists preferred_contact_method text,
  add column if not exists billing_address text,
  add column if not exists contact_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_preferred_contact_method_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_preferred_contact_method_check
      check (
        preferred_contact_method is null
        or lower(preferred_contact_method) in ('email', 'phone', 'text', 'any')
      );
  end if;
end $$;

-- Prefer company_name as display; keep contact_name for person name when distinct.
update public.customers
set contact_name = coalesce(nullif(btrim(contact_name), ''), nullif(btrim(full_name), ''), nullif(btrim(name), ''))
where contact_name is null;

update public.customers
set billing_address = coalesce(
  nullif(btrim(billing_address), ''),
  nullif(btrim(address_line1), ''),
  nullif(btrim(service_address), '')
)
where billing_address is null
  and (
    nullif(btrim(address_line1), '') is not null
    or nullif(btrim(service_address), '') is not null
  );

-- ---------------------------------------------------------------------------
-- 2) Recurring series table
-- ---------------------------------------------------------------------------
create table if not exists public.recurring_job_series (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  property_id uuid references public.customer_properties (id) on delete set null,
  title text not null,
  job_type text,
  recurrence_frequency text not null default 'weekly',
  recurrence_interval integer not null default 1,
  recurrence_weekday integer,
  start_date date not null,
  end_date date,
  occurrence_limit integer,
  preferred_start_time text,
  duration_minutes integer,
  timezone text,
  default_price numeric(12, 2),
  checklist_id uuid,
  preferred_contractor_id uuid,
  notes text,
  customer_name text,
  customer_email text,
  customer_phone text,
  service_address text,
  status text not null default 'active',
  next_generation_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_job_series_frequency_check
    check (recurrence_frequency in ('none', 'weekly', 'biweekly', 'every_four_weeks', 'monthly', 'custom')),
  constraint recurring_job_series_interval_check
    check (recurrence_interval >= 1 and recurrence_interval <= 52),
  constraint recurring_job_series_weekday_check
    check (recurrence_weekday is null or (recurrence_weekday >= 0 and recurrence_weekday <= 6)),
  constraint recurring_job_series_status_check
    check (status in ('active', 'paused', 'ended'))
);

create index if not exists recurring_job_series_org_status_idx
  on public.recurring_job_series (organization_id, status);

create index if not exists recurring_job_series_next_gen_idx
  on public.recurring_job_series (organization_id, next_generation_date)
  where status = 'active';

alter table public.jobs
  add column if not exists recurring_series_id uuid references public.recurring_job_series (id) on delete set null,
  add column if not exists occurrence_date date,
  add column if not exists is_skipped boolean not null default false,
  add column if not exists customer_email text;

create index if not exists jobs_recurring_series_id_idx
  on public.jobs (recurring_series_id);

create unique index if not exists jobs_recurring_series_occurrence_uidx
  on public.jobs (recurring_series_id, occurrence_date)
  where recurring_series_id is not null and occurrence_date is not null;

comment on table public.recurring_job_series is
  'Recurring job series configuration. Individual occurrences are rows in jobs linked by recurring_series_id.';

comment on column public.jobs.occurrence_date is
  'Calendar date of this occurrence in the series timezone. Used for idempotent generation.';

-- ---------------------------------------------------------------------------
-- 3) RLS
-- ---------------------------------------------------------------------------
alter table public.recurring_job_series enable row level security;

drop policy if exists recurring_job_series_select on public.recurring_job_series;
drop policy if exists recurring_job_series_write on public.recurring_job_series;

create policy recurring_job_series_select on public.recurring_job_series
  for select using (
    public.can_manage_organization(organization_id)
    or (
      public.is_org_member(organization_id)
      and exists (
        select 1
        from public.jobs j
        where j.recurring_series_id = recurring_job_series.id
          and public.is_assigned_to_job(j.id)
      )
    )
  );

create policy recurring_job_series_write on public.recurring_job_series
  for all using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));

notify pgrst, 'reload schema';
