-- Production repair: align workspace, account, jobs, CRM, and staffing schema.
-- Safe to run more than once.

create extension if not exists "pgcrypto";

-- Profiles used by account settings and team displays.
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists display_name text,
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists avatar_url text,
  add column if not exists business_name text,
  add column if not exists email text,
  add column if not exists marketing_emails boolean default false,
  add column if not exists product_updates boolean default true,
  add column if not exists operational_notifications boolean default true,
  add column if not exists email_notifications boolean default true,
  add column if not exists push_notifications boolean default false,
  add column if not exists sms_notifications boolean default false,
  add column if not exists preferred_locale text default 'en',
  add column if not exists locale text default 'en',
  add column if not exists deleted_at timestamptz,
  add column if not exists deletion_scheduled_at timestamptz;

update public.profiles
set display_name = coalesce(nullif(display_name, ''), nullif(full_name, ''), nullif(email, ''))
where display_name is null;

update public.profiles
set full_name = coalesce(nullif(full_name, ''), nullif(display_name, ''), trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')))
where full_name is null;

-- Workspace settings used by /settings.
create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  company_phone text,
  company_email text,
  website text,
  company_address text,
  service_type text,
  booking_url text,
  notification_assignments boolean default true,
  notification_due_dates boolean default true,
  notification_completions boolean default true,
  notification_reports boolean default true,
  timezone text default 'America/New_York',
  team_size text,
  industry text,
  legal_business_name text,
  tax_id text,
  invoice_footer text,
  default_customer_message text,
  team_display_name text,
  brand_primary_color text,
  brand_accent_color text,
  logo_path text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.organization_settings
  add column if not exists company_phone text,
  add column if not exists company_email text,
  add column if not exists website text,
  add column if not exists company_address text,
  add column if not exists service_type text,
  add column if not exists booking_url text,
  add column if not exists notification_assignments boolean default true,
  add column if not exists notification_due_dates boolean default true,
  add column if not exists notification_completions boolean default true,
  add column if not exists notification_reports boolean default true,
  add column if not exists timezone text default 'America/New_York',
  add column if not exists team_size text,
  add column if not exists industry text,
  add column if not exists legal_business_name text,
  add column if not exists tax_id text,
  add column if not exists invoice_footer text,
  add column if not exists default_customer_message text,
  add column if not exists team_display_name text,
  add column if not exists brand_primary_color text,
  add column if not exists brand_accent_color text,
  add column if not exists logo_path text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.organization_settings enable row level security;

drop policy if exists organization_settings_member_select on public.organization_settings;
create policy organization_settings_member_select on public.organization_settings
  for select using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = organization_settings.organization_id
        and om.user_id = auth.uid()
        and om.active = true
    )
  );

drop policy if exists organization_settings_admin_write on public.organization_settings;
create policy organization_settings_admin_write on public.organization_settings
  for all using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = organization_settings.organization_id
        and om.user_id = auth.uid()
        and om.active = true
        and om.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = organization_settings.organization_id
        and om.user_id = auth.uid()
        and om.active = true
        and om.role in ('owner', 'admin')
    )
  );

-- Customers, leads, and assignment fields.
alter table public.customers
  add column if not exists company_name text,
  add column if not exists name text,
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists address text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists country text,
  add column if not exists service_address text,
  add column if not exists property_address text,
  add column if not exists notes text,
  add column if not exists logo_path text,
  add column if not exists pipeline_stage text default 'active',
  add column if not exists lead_source text,
  add column if not exists record_type text default 'customer',
  add column if not exists assigned_to uuid,
  add column if not exists organization_id uuid,
  add column if not exists user_id uuid,
  add column if not exists deal_value numeric(12,2),
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.customers
set company_name = coalesce(nullif(company_name, ''), nullif(name, ''), nullif(full_name, ''), nullif(email, ''), nullif(phone, ''), 'Unnamed contact')
where company_name is null or company_name = '';

update public.customers
set name = coalesce(nullif(name, ''), company_name),
    full_name = coalesce(nullif(full_name, ''), company_name)
where name is null or name = '' or full_name is null or full_name = '';

update public.customers
set record_type = case
  when record_type = 'lead' or pipeline_stage in ('lead', 'qualified', 'contacted', 'proposal_sent', 'negotiating', 'closed_lost', 'cancelled') then 'lead'
  else coalesce(record_type, 'customer')
end
where record_type is null or record_type not in ('lead', 'customer', 'staffing');

update public.customers
set pipeline_stage = case
  when record_type = 'lead' and (pipeline_stage is null or pipeline_stage = '') then 'open'
  when record_type = 'customer' and (pipeline_stage is null or pipeline_stage in ('lead', 'qualified')) then 'active'
  else pipeline_stage
end;

create index if not exists customers_org_record_type_idx on public.customers (organization_id, record_type);
create index if not exists customers_org_assigned_to_idx on public.customers (organization_id, assigned_to);
create index if not exists customers_user_record_type_idx on public.customers (user_id, record_type);

-- Jobs repair: columns and status constraint.
alter table public.jobs
  add column if not exists organization_id uuid,
  add column if not exists customer_id uuid,
  add column if not exists customer_name text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists notes text,
  add column if not exists status text default 'new',
  add column if not exists start_date date,
  add column if not exists due_date date,
  add column if not exists scheduled_start timestamptz,
  add column if not exists scheduled_end timestamptz,
  add column if not exists assigned_to uuid,
  add column if not exists assigned_email text,
  add column if not exists priority text default 'normal',
  add column if not exists internal_notes text,
  add column if not exists customer_notes text,
  add column if not exists completion_verified boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists completed_at timestamptz;

update public.jobs set status = 'new' where status is null or status = '';
update public.jobs set status = 'active' where status in ('in_progress', 'started', 'start');
update public.jobs set status = 'completed' where status in ('complete', 'done');
update public.jobs set status = 'cancelled' where status in ('canceled', 'void');

do $$
begin
  alter table public.jobs drop constraint if exists jobs_status_check;
exception when undefined_object then null;
end $$;

alter table public.jobs
  add constraint jobs_status_check
  check (status in ('new', 'scheduled', 'active', 'completed', 'cancelled', 'on_hold'));

create index if not exists jobs_org_status_idx on public.jobs (organization_id, status);
create index if not exists jobs_org_assigned_to_idx on public.jobs (organization_id, assigned_to);
create index if not exists jobs_user_status_idx on public.jobs (user_id, status);

-- Staffing CRM: separate from customer sales pipeline.
create table if not exists public.staffing_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  assigned_to uuid,
  name text not null,
  email text,
  phone text,
  address text,
  notes text,
  role_interest text,
  source text,
  status text not null default 'applicant',
  signed_at timestamptz,
  inactive_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint staffing_records_status_check check (status in ('applicant', 'interview', 'background_check', 'offer_sent', 'contractor', 'employee', 'inactive', 'rejected', 'rehired'))
);

alter table public.staffing_records enable row level security;

create index if not exists staffing_records_org_status_idx on public.staffing_records (organization_id, status);
create index if not exists staffing_records_org_assigned_to_idx on public.staffing_records (organization_id, assigned_to);

drop policy if exists staffing_records_manager_all on public.staffing_records;
create policy staffing_records_manager_all on public.staffing_records
  for all using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = staffing_records.organization_id
        and om.user_id = auth.uid()
        and om.active = true
        and om.role in ('owner', 'admin', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = staffing_records.organization_id
        and om.user_id = auth.uid()
        and om.active = true
        and om.role in ('owner', 'admin', 'manager')
    )
  );

-- Updated-at helper for core tables.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists organization_settings_set_updated_at on public.organization_settings;
create trigger organization_settings_set_updated_at
before update on public.organization_settings
for each row execute function public.set_updated_at();

drop trigger if exists staffing_records_set_updated_at on public.staffing_records;
create trigger staffing_records_set_updated_at
before update on public.staffing_records
for each row execute function public.set_updated_at();
