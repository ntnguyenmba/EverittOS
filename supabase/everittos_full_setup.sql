-- =============================================================================
-- EverittOS full database setup (idempotent)
-- Run once in Supabase SQL Editor on a fresh project or a project with no
-- EverittOS migrations applied.
--
-- Safe to re-run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / DROP POLICY IF EXISTS.
-- Matches EverittOS main through launch growth features (202605370001).
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 0. Repair broken partial schemas (empty tables missing expected columns)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'business_profiles'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'business_profiles' and column_name = 'user_id'
  ) then
    execute 'drop table if exists public.business_profiles cascade';
    raise notice 'Dropped legacy business_profiles without user_id.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Utility functions
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Core identity tables
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text default 'owner',
  plan text default 'free',
  subscription_status text default 'free',
  stripe_customer_id text,
  business_name text,
  full_name text,
  phone text,
  organization_id uuid,
  account_status text not null default 'active',
  reroot_report_access boolean default false,
  reroot_premium_until timestamptz,
  created_at timestamptz default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists role text default 'owner';
alter table public.profiles add column if not exists plan text default 'free';
alter table public.profiles add column if not exists subscription_status text default 'free';
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists business_name text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists organization_id uuid;
alter table public.profiles add column if not exists account_status text not null default 'active';
alter table public.profiles add column if not exists reroot_report_access boolean default false;
alter table public.profiles add column if not exists reroot_premium_until timestamptz;
alter table public.profiles add column if not exists created_at timestamptz default now();

create table if not exists public.business_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  business_name text,
  phone text,
  email text,
  logo_path text,
  support_email text,
  service_type text,
  booking_url text,
  onboarding_completed boolean not null default false,
  updated_at timestamptz default now()
);

alter table public.business_profiles add column if not exists business_name text;
alter table public.business_profiles add column if not exists phone text;
alter table public.business_profiles add column if not exists email text;
alter table public.business_profiles add column if not exists logo_path text;
alter table public.business_profiles add column if not exists support_email text;
alter table public.business_profiles add column if not exists service_type text;
alter table public.business_profiles add column if not exists booking_url text;
alter table public.business_profiles add column if not exists onboarding_completed boolean not null default false;
alter table public.business_profiles add column if not exists updated_at timestamptz default now();

-- ---------------------------------------------------------------------------
-- 3. Organizations and plan limits
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  parent_organization_id uuid references public.organizations (id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  logo_path text,
  company_phone text,
  company_email text,
  company_address text,
  service_type text,
  booking_url text,
  industry text,
  team_size text,
  website text,
  onboarding_step int not null default 0,
  onboarding_completed boolean not null default false,
  notification_assignments boolean default true,
  notification_due_dates boolean default true,
  notification_completions boolean default true,
  notification_reports boolean default true,
  brand_primary_color text,
  brand_accent_color text,
  enterprise_onboarding_notes text,
  updated_at timestamptz default now()
);

alter table public.organization_settings add column if not exists company_address text;
alter table public.organization_settings add column if not exists industry text;
alter table public.organization_settings add column if not exists team_size text;
alter table public.organization_settings add column if not exists website text;
alter table public.organization_settings add column if not exists onboarding_step int not null default 0;
alter table public.organization_settings add column if not exists onboarding_completed boolean not null default false;

create table if not exists public.organization_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  address text,
  timezone text default 'UTC',
  created_at timestamptz default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'staff',
  active boolean not null default true,
  created_at timestamptz default now(),
  unique (organization_id, user_id)
);

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role text not null default 'staff',
  job_id uuid,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending',
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz default now()
);

alter table public.organization_invitations add column if not exists job_id uuid;

create table if not exists public.plan_tier_limits (
  plan_id text primary key,
  jobs_cap int not null,
  photos_cap int not null,
  customers_cap int not null,
  reports_cap int not null,
  team_members_cap int not null,
  crew_members_cap int not null,
  locations_cap int not null,
  crew_assignment boolean not null default false,
  team_management boolean not null default false,
  scheduling boolean not null default true,
  activity_log boolean not null default false,
  advanced_reporting boolean not null default false,
  workflow_customization boolean not null default false,
  multi_location boolean not null default false,
  custom_branding boolean not null default false,
  pdf_reports boolean not null default true
);

alter table public.profiles
  drop constraint if exists profiles_organization_id_fkey;
alter table public.profiles
  add constraint profiles_organization_id_fkey
  foreign key (organization_id) references public.organizations (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 4. Operational tables
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  department_id uuid,
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.customers add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.customers add column if not exists department_id uuid;
alter table public.customers add column if not exists updated_at timestamptz default now();

create table if not exists public.customer_properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  address text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

alter table public.crews add column if not exists organization_id uuid references public.organizations (id) on delete cascade;

create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  department_id uuid,
  auth_user_id uuid references auth.users (id) on delete set null,
  name text not null,
  role text,
  phone text,
  notes text,
  created_at timestamptz default now()
);

alter table public.workers add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.workers add column if not exists department_id uuid;
alter table public.workers add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  property_id uuid,
  crew_id uuid references public.crews (id) on delete set null,
  department_id uuid,
  workflow_template_id uuid,
  assigned_to uuid,
  title text not null,
  customer_name text,
  phone text,
  address text,
  location_name text,
  notes text,
  service_type text,
  status text default 'new',
  priority text default 'normal',
  internal_notes text,
  customer_notes text,
  completion_verified boolean default false,
  scheduled_at timestamptz,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  start_date date,
  due_date date,
  price_estimate numeric(12, 2),
  before_photo_url text,
  after_photo_url text,
  completion_notes text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

alter table public.jobs add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.jobs add column if not exists property_id uuid;
alter table public.jobs add column if not exists crew_id uuid;
alter table public.jobs add column if not exists department_id uuid;
alter table public.jobs add column if not exists workflow_template_id uuid;
alter table public.jobs add column if not exists location_name text;
alter table public.jobs add column if not exists start_date date;
alter table public.jobs add column if not exists due_date date;
alter table public.jobs add column if not exists scheduled_start timestamptz;
alter table public.jobs add column if not exists scheduled_end timestamptz;
alter table public.jobs add column if not exists priority text default 'normal';
alter table public.jobs add column if not exists internal_notes text;
alter table public.jobs add column if not exists customer_notes text;
alter table public.jobs add column if not exists completion_verified boolean default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'jobs_assigned_to_fkey'
  ) then
    alter table public.jobs
      add constraint jobs_assigned_to_fkey
      foreign key (assigned_to) references public.workers (id) on delete set null;
  end if;
exception when others then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'jobs_property_id_fkey'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'customer_properties'
  ) then
    alter table public.jobs
      add constraint jobs_property_id_fkey
      foreign key (property_id) references public.customer_properties (id) on delete set null;
  end if;
exception when others then null;
end $$;

create table if not exists public.job_assignments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  worker_id uuid not null references public.workers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  responsibility text,
  created_at timestamptz default now(),
  unique (job_id, worker_id)
);

alter table public.job_assignments add column if not exists organization_id uuid references public.organizations (id) on delete cascade;

create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  storage_path text not null,
  label text not null default 'other',
  created_at timestamptz default now()
);

alter table public.job_photos add column if not exists organization_id uuid references public.organizations (id) on delete cascade;

create table if not exists public.job_timeline (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  event_type text not null,
  message text,
  created_at timestamptz default now()
);

alter table public.job_timeline add column if not exists organization_id uuid references public.organizations (id) on delete cascade;

create table if not exists public.job_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  title text not null,
  created_at timestamptz default now()
);

alter table public.job_reports add column if not exists organization_id uuid references public.organizations (id) on delete cascade;

create table if not exists public.job_checklist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  completed boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.job_client_access (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  client_user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  portal_token text unique default encode(gen_random_bytes(18), 'hex'),
  granted_at timestamptz default now(),
  can_view_photos boolean not null default true,
  can_view_notes boolean not null default true,
  can_view_reports boolean not null default true,
  created_at timestamptz default now(),
  unique (job_id, client_user_id)
);

alter table public.job_client_access add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.job_client_access add column if not exists portal_token text unique default encode(gen_random_bytes(18), 'hex');
alter table public.job_client_access add column if not exists granted_at timestamptz default now();

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  actor_name text,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  message text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  related_job_id uuid references public.jobs (id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.everittos_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  plan text not null,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_session_id text unique,
  status text not null default 'active',
  current_period_end timestamptz,
  cancelled_at timestamptz,
  last_payment_status text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.everittos_subscriptions add column if not exists cancelled_at timestamptz;
alter table public.everittos_subscriptions add column if not exists last_payment_status text;

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  event_type text not null,
  plan text,
  stripe_event_id text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  event_name text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Launch growth tables
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  key_hash text not null,
  key_prefix text not null,
  scopes text[] not null default array['read:jobs', 'write:jobs', 'read:customers', 'read:workers'],
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create table if not exists public.workflow_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflow_templates (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  description text,
  sort_order int not null default 0,
  required boolean not null default true,
  step_type text not null default 'checklist',
  created_at timestamptz not null default now()
);

create table if not exists public.job_workflow_progress (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  workflow_step_id uuid not null references public.workflow_steps (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  note text,
  photo_path text,
  created_at timestamptz not null default now(),
  unique (job_id, workflow_step_id)
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.department_memberships (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (department_id, user_id)
);

-- Deferred FKs for columns added before referenced tables existed
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'organization_invitations_job_id_fkey') then
    alter table public.organization_invitations
      add constraint organization_invitations_job_id_fkey
      foreign key (job_id) references public.jobs (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_workflow_template_id_fkey') then
    alter table public.jobs
      add constraint jobs_workflow_template_id_fkey
      foreign key (workflow_template_id) references public.workflow_templates (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_department_id_fkey') then
    alter table public.jobs
      add constraint jobs_department_id_fkey
      foreign key (department_id) references public.departments (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'customers_department_id_fkey') then
    alter table public.customers
      add constraint customers_department_id_fkey
      foreign key (department_id) references public.departments (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workers_department_id_fkey') then
    alter table public.workers
      add constraint workers_department_id_fkey
      foreign key (department_id) references public.departments (id) on delete set null;
  end if;
exception when others then null;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Check constraints (drop + recreate for idempotency)
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check
  check (plan in ('free', 'pro', 'business', 'growth', 'enterprise'));

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('owner', 'admin', 'manager', 'employee', 'contractor', 'crew_lead', 'staff', 'client'));

alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check
  check (account_status in ('active', 'disabled'));

alter table public.everittos_subscriptions drop constraint if exists everittos_subscriptions_plan_check;
alter table public.everittos_subscriptions add constraint everittos_subscriptions_plan_check
  check (plan in ('pro', 'business', 'growth', 'enterprise'));

alter table public.organization_members drop constraint if exists organization_members_role_check;
alter table public.organization_members add constraint organization_members_role_check
  check (role in ('owner', 'manager', 'employee', 'contractor', 'client', 'admin', 'crew_lead', 'staff'));

alter table public.organization_invitations drop constraint if exists organization_invitations_role_check;
alter table public.organization_invitations add constraint organization_invitations_role_check
  check (role in ('manager', 'employee', 'contractor', 'client', 'admin', 'crew_lead', 'staff'));

alter table public.organization_invitations drop constraint if exists organization_invitations_status_check;
alter table public.organization_invitations add constraint organization_invitations_status_check
  check (status in ('pending', 'accepted', 'revoked', 'expired'));

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('assignment', 'due_date', 'completion', 'report'));

alter table public.jobs drop constraint if exists jobs_priority_check;
alter table public.jobs add constraint jobs_priority_check
  check (priority in ('low', 'normal', 'high', 'urgent'));

alter table public.job_photos drop constraint if exists job_photos_label_check;
alter table public.job_photos add constraint job_photos_label_check
  check (label in ('before', 'progress', 'during', 'after', 'other'));

alter table public.workflow_steps drop constraint if exists workflow_steps_step_type_check;
alter table public.workflow_steps add constraint workflow_steps_step_type_check
  check (step_type in ('checklist', 'photo', 'note', 'approval'));

-- ---------------------------------------------------------------------------
-- 6. Indexes
-- ---------------------------------------------------------------------------
create index if not exists customers_user_id_idx on public.customers (user_id);
create index if not exists customers_organization_id_idx on public.customers (organization_id);
create index if not exists customers_department_idx on public.customers (department_id);
create index if not exists workers_user_id_idx on public.workers (user_id);
create index if not exists workers_auth_user_id_idx on public.workers (auth_user_id);
create index if not exists jobs_user_id_idx on public.jobs (user_id);
create index if not exists jobs_organization_id_idx on public.jobs (organization_id);
create index if not exists jobs_status_idx on public.jobs (status);
create index if not exists jobs_scheduled_at_idx on public.jobs (scheduled_at);
create index if not exists jobs_scheduled_start_idx on public.jobs (scheduled_start);
create index if not exists jobs_due_date_idx on public.jobs (due_date);
create index if not exists jobs_crew_id_idx on public.jobs (crew_id);
create index if not exists jobs_department_idx on public.jobs (department_id);
create index if not exists jobs_workflow_template_idx on public.jobs (workflow_template_id);
create index if not exists job_photos_job_id_idx on public.job_photos (job_id);
create index if not exists job_photos_organization_id_idx on public.job_photos (organization_id);
create index if not exists job_assignments_job_id_idx on public.job_assignments (job_id);
create index if not exists job_reports_user_id_idx on public.job_reports (user_id);
create index if not exists job_reports_job_id_idx on public.job_reports (job_id);
create index if not exists job_reports_organization_id_idx on public.job_reports (organization_id);
create index if not exists job_client_access_client_idx on public.job_client_access (client_user_id);
create index if not exists job_client_access_job_idx on public.job_client_access (job_id);
create index if not exists job_client_access_token_idx on public.job_client_access (portal_token);
create index if not exists organization_members_org_idx on public.organization_members (organization_id);
create index if not exists organization_members_user_idx on public.organization_members (user_id);
create index if not exists organization_invitations_email_idx on public.organization_invitations (email);
create index if not exists organization_invitations_status_idx on public.organization_invitations (status);
create index if not exists activity_logs_org_idx on public.activity_logs (organization_id, created_at desc);
create index if not exists activity_logs_created_at_idx on public.activity_logs (created_at desc);
create index if not exists notifications_user_idx on public.notifications (user_id, read_at);
create index if not exists product_events_org_idx on public.product_events (organization_id, created_at desc);
create index if not exists product_events_event_name_idx on public.product_events (event_name);
create index if not exists subscription_events_email_idx on public.subscription_events (email);
create index if not exists profiles_account_status_idx on public.profiles (account_status);
create index if not exists api_keys_org_idx on public.api_keys (organization_id);
create index if not exists api_keys_prefix_idx on public.api_keys (key_prefix);
create index if not exists api_keys_hash_idx on public.api_keys (key_hash);
create index if not exists workflow_templates_org_idx on public.workflow_templates (organization_id);
create index if not exists workflow_steps_workflow_idx on public.workflow_steps (workflow_id, sort_order);
create index if not exists job_workflow_progress_job_idx on public.job_workflow_progress (job_id);
create index if not exists departments_org_idx on public.departments (organization_id);
create index if not exists department_memberships_user_idx on public.department_memberships (user_id);
create index if not exists department_memberships_dept_idx on public.department_memberships (department_id);
create index if not exists crews_user_id_idx on public.crews (user_id);

-- ---------------------------------------------------------------------------
-- 7. Seed plan_tier_limits (matches lib/plan-config.ts)
-- ---------------------------------------------------------------------------
insert into public.plan_tier_limits (
  plan_id, jobs_cap, photos_cap, customers_cap, reports_cap, team_members_cap, crew_members_cap, locations_cap,
  crew_assignment, team_management, scheduling, activity_log, advanced_reporting, workflow_customization,
  multi_location, custom_branding, pdf_reports
) values
  ('free', 3, 0, 10, 10, 1, 0, 1, false, false, true, false, false, false, false, false, true),
  ('pro', 25, -1, 100, -1, 3, 0, 1, false, false, true, false, false, false, false, false, true),
  ('business', 150, -1, 1000, -1, 15, 100, 1, true, true, true, true, false, false, false, false, true),
  ('growth', 2500, -1, 25000, -1, 250, -1, 25, true, true, true, true, true, true, true, true, true),
  ('enterprise', -1, -1, -1, -1, -1, -1, -1, true, true, true, true, true, true, true, true, true)
on conflict (plan_id) do update set
  jobs_cap = excluded.jobs_cap,
  photos_cap = excluded.photos_cap,
  customers_cap = excluded.customers_cap,
  reports_cap = excluded.reports_cap,
  team_members_cap = excluded.team_members_cap,
  crew_members_cap = excluded.crew_members_cap,
  locations_cap = excluded.locations_cap,
  crew_assignment = excluded.crew_assignment,
  team_management = excluded.team_management,
  scheduling = excluded.scheduling,
  activity_log = excluded.activity_log,
  advanced_reporting = excluded.advanced_reporting,
  workflow_customization = excluded.workflow_customization,
  multi_location = excluded.multi_location,
  custom_branding = excluded.custom_branding,
  pdf_reports = excluded.pdf_reports;

delete from public.plan_tier_limits where plan_id in ('starter', 'operations');

-- ---------------------------------------------------------------------------
-- 8. Helper functions
-- ---------------------------------------------------------------------------
create or replace function public.current_profile_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(role, 'owner') from public.profiles where id = auth.uid();
$$;

create or replace function public.is_assigned_to_job(target_job_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.job_assignments ja
    join public.workers w on w.id = ja.worker_id
    where ja.job_id = target_job_id and w.auth_user_id = auth.uid()
  ) or exists (
    select 1 from public.jobs j
    join public.workers w on w.id = j.assigned_to
    where j.id = target_job_id and w.auth_user_id = auth.uid()
  );
$$;

create or replace function public.client_can_view_job(target_job_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.job_client_access jca
    where jca.job_id = target_job_id and jca.client_user_id = auth.uid()
  );
$$;

create or replace function public.plan_for_organization(org_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(p.plan, 'free')
  from public.organizations o
  join public.profiles p on p.id = o.owner_user_id
  where o.id = org_id;
$$;

create or replace function public.plan_limit_cap(p_plan text, p_resource text)
returns int language sql stable security definer set search_path = public as $$
  select case p_resource
    when 'jobs' then jobs_cap when 'photos' then photos_cap when 'customers' then customers_cap
    when 'reports' then reports_cap when 'team_members' then team_members_cap
    when 'crew_members' then crew_members_cap when 'locations' then locations_cap else -1
  end from public.plan_tier_limits where plan_id = coalesce(p_plan, 'free');
$$;

create or replace function public.current_user_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.organization_members where user_id = auth.uid() and active = true;
$$;

create or replace function public.member_role_in_org(org_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.organization_members
  where organization_id = org_id and user_id = auth.uid() and active = true limit 1;
$$;

create or replace function public.can_manage_organization(org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.member_role_in_org(org_id) in ('owner', 'admin', 'manager');
$$;

create or replace function public.is_org_member(org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id and user_id = auth.uid() and active = true
  );
$$;

create or replace function public.enforce_org_resource_limit(
  p_org_id uuid, p_resource text, p_table text, p_extra_filter text default ''
) returns void language plpgsql security definer set search_path = public as $$
declare cap int; cnt int; sql text;
begin
  cap := public.plan_limit_cap(public.plan_for_organization(p_org_id), p_resource);
  if cap < 0 then return; end if;
  sql := format('select count(*)::int from public.%I where organization_id = $1', p_table);
  if p_extra_filter <> '' then sql := sql || ' and ' || p_extra_filter; end if;
  execute sql into cnt using p_org_id;
  if cnt >= cap then raise exception 'PLAN_LIMIT_%', upper(p_resource); end if;
end;
$$;

create or replace function public.log_activity(
  p_org_id uuid, p_entity_type text, p_entity_id uuid, p_action text,
  p_message text default null, p_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (select activity_log from public.plan_tier_limits where plan_id = public.plan_for_organization(p_org_id)) then
    return;
  end if;
  insert into public.activity_logs (organization_id, user_id, actor_name, entity_type, entity_id, action, message, metadata)
  values (p_org_id, auth.uid(), (select coalesce(full_name, email) from public.profiles where id = auth.uid()),
    p_entity_type, p_entity_id, p_action, p_message, p_metadata);
end;
$$;

create or replace function public.set_row_organization_id()
returns trigger language plpgsql security definer set search_path = public as $$
declare oid uuid;
begin
  if new.organization_id is not null then return new; end if;
  select organization_id into oid from public.profiles where id = new.user_id;
  if oid is not null then new.organization_id := oid; end if;
  return new;
end;
$$;

create or replace function public.enforce_job_insert_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is not null then
    perform public.enforce_org_resource_limit(new.organization_id, 'jobs', 'jobs', 'status is distinct from ''cancelled''');
  else
    perform public.enforce_org_resource_limit(
      (select organization_id from public.profiles where id = new.user_id),
      'jobs', 'jobs', 'status is distinct from ''cancelled'''
    );
  end if;
  return new;
end;
$$;

create or replace function public.enforce_customer_insert_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare oid uuid;
begin
  oid := coalesce(new.organization_id, (select organization_id from public.profiles where id = new.user_id));
  perform public.enforce_org_resource_limit(oid, 'customers', 'customers');
  return new;
end;
$$;

create or replace function public.enforce_photo_insert_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare oid uuid; p text; photo_cap int;
begin
  oid := coalesce(new.organization_id, (select organization_id from public.profiles where id = new.user_id));
  p := public.plan_for_organization(oid);
  photo_cap := public.plan_limit_cap(p, 'photos');
  if photo_cap = 0 then raise exception 'PLAN_REQUIRES_PRO_PHOTOS'; end if;
  if photo_cap < 0 then return new; end if;
  perform public.enforce_org_resource_limit(oid, 'photos', 'job_photos');
  return new;
end;
$$;

create or replace function public.enforce_report_insert_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare oid uuid; p text;
begin
  oid := coalesce(new.organization_id, (select organization_id from public.profiles where id = new.user_id));
  p := public.plan_for_organization(oid);
  if not (select pdf_reports from public.plan_tier_limits where plan_id = p) then
    raise exception 'PLAN_LIMIT_REPORTS';
  end if;
  perform public.enforce_org_resource_limit(oid, 'reports', 'job_reports');
  return new;
end;
$$;

create or replace function public.enforce_worker_insert_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare oid uuid; p text;
begin
  oid := coalesce(new.organization_id, (select organization_id from public.profiles where id = new.user_id));
  p := public.plan_for_organization(oid);
  if not (select crew_assignment from public.plan_tier_limits where plan_id = p) then
    raise exception 'PLAN_REQUIRES_CREW';
  end if;
  perform public.enforce_org_resource_limit(oid, 'crew_members', 'workers');
  return new;
end;
$$;

create or replace function public.enforce_team_member_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'owner' then return new; end if;
  if not (select team_management from public.plan_tier_limits where plan_id = public.plan_for_organization(new.organization_id)) then
    raise exception 'PLAN_REQUIRES_TEAM';
  end if;
  perform public.enforce_org_resource_limit(new.organization_id, 'team_members', 'organization_members', 'active = true');
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, plan, subscription_status, business_name, account_status)
  values (new.id, new.email, 'free', 'free', coalesce(new.raw_user_meta_data->>'business_name', null), 'active')
  on conflict (id) do update set email = excluded.email;

  insert into public.business_profiles (user_id, business_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'business_name', null), new.email)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Triggers
-- ---------------------------------------------------------------------------
drop trigger if exists customers_updated_at on public.customers;
create trigger customers_updated_at before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists jobs_plan_limit_insert on public.jobs;
create trigger jobs_plan_limit_insert before insert on public.jobs
for each row execute function public.enforce_job_insert_limit();

drop trigger if exists customers_plan_limit_insert on public.customers;
create trigger customers_plan_limit_insert before insert on public.customers
for each row execute function public.enforce_customer_insert_limit();

drop trigger if exists job_photos_plan_limit_insert on public.job_photos;
create trigger job_photos_plan_limit_insert before insert on public.job_photos
for each row execute function public.enforce_photo_insert_limit();

drop trigger if exists job_reports_plan_limit_insert on public.job_reports;
create trigger job_reports_plan_limit_insert before insert on public.job_reports
for each row execute function public.enforce_report_insert_limit();

drop trigger if exists workers_plan_limit_insert on public.workers;
create trigger workers_plan_limit_insert before insert on public.workers
for each row execute function public.enforce_worker_insert_limit();

drop trigger if exists organization_members_team_limit on public.organization_members;
create trigger organization_members_team_limit before insert on public.organization_members
for each row execute function public.enforce_team_member_insert();

drop trigger if exists jobs_set_org on public.jobs;
create trigger jobs_set_org before insert on public.jobs
for each row execute function public.set_row_organization_id();

drop trigger if exists customers_set_org on public.customers;
create trigger customers_set_org before insert on public.customers
for each row execute function public.set_row_organization_id();

drop trigger if exists workers_set_org on public.workers;
create trigger workers_set_org before insert on public.workers
for each row execute function public.set_row_organization_id();

-- ---------------------------------------------------------------------------
-- 10. Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.business_profiles enable row level security;
alter table public.customers enable row level security;
alter table public.workers enable row level security;
alter table public.jobs enable row level security;
alter table public.job_assignments enable row level security;
alter table public.job_photos enable row level security;
alter table public.job_timeline enable row level security;
alter table public.job_reports enable row level security;
alter table public.job_client_access enable row level security;
alter table public.crews enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_settings enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.organization_locations enable row level security;
alter table public.customer_properties enable row level security;
alter table public.job_checklist_items enable row level security;
alter table public.activity_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.plan_tier_limits enable row level security;
alter table public.everittos_subscriptions enable row level security;
alter table public.subscription_events enable row level security;
alter table public.product_events enable row level security;
alter table public.api_keys enable row level security;
alter table public.workflow_templates enable row level security;
alter table public.workflow_steps enable row level security;
alter table public.job_workflow_progress enable row level security;
alter table public.departments enable row level security;
alter table public.department_memberships enable row level security;

-- profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);

-- business_profiles
drop policy if exists business_profiles_own on public.business_profiles;
create policy business_profiles_own on public.business_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- plan_tier_limits
drop policy if exists plan_tier_limits_read on public.plan_tier_limits;
create policy plan_tier_limits_read on public.plan_tier_limits for select to authenticated using (true);

-- organizations
drop policy if exists organizations_member_select on public.organizations;
create policy organizations_member_select on public.organizations for select using (public.is_org_member(id));
drop policy if exists organizations_owner_update on public.organizations;
create policy organizations_owner_update on public.organizations
  for update using (public.member_role_in_org(id) in ('owner', 'admin'))
  with check (public.member_role_in_org(id) in ('owner', 'admin'));
drop policy if exists organizations_owner_insert on public.organizations;
create policy organizations_owner_insert on public.organizations for insert with check (auth.uid() = owner_user_id);

-- organization_settings
drop policy if exists organization_settings_member on public.organization_settings;
create policy organization_settings_member on public.organization_settings
  for all using (public.is_org_member(organization_id))
  with check (public.can_manage_organization(organization_id));

-- organization_members
drop policy if exists organization_members_select on public.organization_members;
create policy organization_members_select on public.organization_members for select using (public.is_org_member(organization_id));
drop policy if exists organization_members_manage on public.organization_members;
create policy organization_members_manage on public.organization_members
  for all using (public.member_role_in_org(organization_id) in ('owner', 'admin'))
  with check (public.member_role_in_org(organization_id) in ('owner', 'admin'));

-- organization_invitations
drop policy if exists organization_invitations_select on public.organization_invitations;
create policy organization_invitations_select on public.organization_invitations for select using (
  public.member_role_in_org(organization_id) in ('owner', 'admin', 'manager')
  or lower(email) = lower(coalesce((select email from public.profiles where id = auth.uid()), ''))
);
drop policy if exists organization_invitations_manage on public.organization_invitations;
create policy organization_invitations_manage on public.organization_invitations
  for all using (public.member_role_in_org(organization_id) in ('owner', 'admin', 'manager'))
  with check (public.member_role_in_org(organization_id) in ('owner', 'admin', 'manager'));

-- org-scoped tenant data
drop policy if exists customers_org on public.customers;
create policy customers_org on public.customers for all using (
  (organization_id is not null and public.is_org_member(organization_id)) or auth.uid() = user_id
) with check (
  (organization_id is not null and public.can_manage_organization(organization_id)) or auth.uid() = user_id
);

drop policy if exists workers_org on public.workers;
create policy workers_org on public.workers for all using (
  (organization_id is not null and public.is_org_member(organization_id)) or auth.uid() = user_id or auth.uid() = auth_user_id
) with check (
  (organization_id is not null and public.can_manage_organization(organization_id)) or auth.uid() = user_id
);

drop policy if exists jobs_org_select on public.jobs;
create policy jobs_org_select on public.jobs for select using (
  (organization_id is not null and public.is_org_member(organization_id))
  or auth.uid() = user_id
  or public.is_assigned_to_job(id)
  or public.client_can_view_job(id)
);

drop policy if exists jobs_org_write on public.jobs;
create policy jobs_org_write on public.jobs for all using (
  (organization_id is not null and public.can_manage_organization(organization_id)) or auth.uid() = user_id
) with check (
  (organization_id is not null and public.can_manage_organization(organization_id)) or auth.uid() = user_id
);

drop policy if exists job_photos_org on public.job_photos;
create policy job_photos_org on public.job_photos for all using (
  (organization_id is not null and public.is_org_member(organization_id)) or auth.uid() = user_id
) with check (
  (organization_id is not null and public.is_org_member(organization_id)) or auth.uid() = user_id
);

drop policy if exists job_assignments_own on public.job_assignments;
drop policy if exists job_assignments_select_role on public.job_assignments;
drop policy if exists job_assignments_write_role on public.job_assignments;
drop policy if exists job_assignments_select on public.job_assignments;
create policy job_assignments_select on public.job_assignments for select using (
  (organization_id is not null and public.is_org_member(organization_id))
  or auth.uid() = user_id
  or public.is_assigned_to_job(job_id)
  or public.client_can_view_job(job_id)
);
drop policy if exists job_assignments_write on public.job_assignments;
create policy job_assignments_write on public.job_assignments
  for all using (
    (organization_id is not null and public.can_manage_organization(organization_id))
    or (auth.uid() = user_id and public.current_profile_role() in ('owner', 'admin'))
  )
  with check (
    (organization_id is not null and public.can_manage_organization(organization_id))
    or (auth.uid() = user_id and public.current_profile_role() in ('owner', 'admin'))
  );

drop policy if exists job_timeline_own on public.job_timeline;
drop policy if exists job_timeline_select_role on public.job_timeline;
drop policy if exists job_timeline_insert_role on public.job_timeline;
drop policy if exists job_timeline_select on public.job_timeline;
create policy job_timeline_select on public.job_timeline for select using (
  (organization_id is not null and public.is_org_member(organization_id))
  or auth.uid() = user_id
  or public.is_assigned_to_job(job_id)
  or (
    public.client_can_view_job(job_id)
    and exists (
      select 1 from public.job_client_access jca
      where jca.job_id = job_timeline.job_id
        and jca.client_user_id = auth.uid()
        and jca.can_view_notes = true
    )
  )
);
drop policy if exists job_timeline_insert on public.job_timeline;
create policy job_timeline_insert on public.job_timeline for insert with check (
  (organization_id is not null and public.is_org_member(organization_id))
  or auth.uid() = user_id
  or (
    public.current_profile_role() in ('contractor', 'staff', 'employee', 'crew_lead')
    and public.is_assigned_to_job(job_id)
  )
);

drop policy if exists job_reports_org on public.job_reports;
create policy job_reports_org on public.job_reports for all using (
  (organization_id is not null and public.is_org_member(organization_id)) or auth.uid() = user_id
) with check (
  (organization_id is not null and public.can_manage_organization(organization_id)) or auth.uid() = user_id
);

drop policy if exists job_client_access_owner on public.job_client_access;
create policy job_client_access_owner on public.job_client_access
  for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
drop policy if exists job_client_access_client_read on public.job_client_access;
create policy job_client_access_client_read on public.job_client_access for select using (auth.uid() = client_user_id);

drop policy if exists activity_logs_org on public.activity_logs;
create policy activity_logs_org on public.activity_logs for select using (public.is_org_member(organization_id));
drop policy if exists activity_logs_insert on public.activity_logs;
create policy activity_logs_insert on public.activity_logs for insert with check (public.is_org_member(organization_id));

drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists customer_properties_org on public.customer_properties;
create policy customer_properties_org on public.customer_properties
  for all using (public.is_org_member(organization_id))
  with check (public.can_manage_organization(organization_id));

drop policy if exists job_checklist_org on public.job_checklist_items;
create policy job_checklist_org on public.job_checklist_items
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists organization_locations_member on public.organization_locations;
create policy organization_locations_member on public.organization_locations
  for all using (public.is_org_member(organization_id))
  with check (public.can_manage_organization(organization_id));

drop policy if exists crews_select_own on public.crews;
create policy crews_select_own on public.crews for select using (auth.uid() = user_id or public.is_org_member(organization_id));
drop policy if exists crews_write_own on public.crews;
create policy crews_write_own on public.crews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists everittos_subscriptions_select on public.everittos_subscriptions;
create policy everittos_subscriptions_select on public.everittos_subscriptions for select using (
  auth.uid() = user_id or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists subscription_events_admin on public.subscription_events;
create policy subscription_events_admin on public.subscription_events for select using (false);

drop policy if exists product_events_insert on public.product_events;
create policy product_events_insert on public.product_events for insert with check (
  organization_id is null or public.is_org_member(organization_id)
);
drop policy if exists product_events_select on public.product_events;
create policy product_events_select on public.product_events for select using (
  organization_id is not null and public.member_role_in_org(organization_id) in ('owner', 'manager')
);

drop policy if exists api_keys_org_manage on public.api_keys;
create policy api_keys_org_manage on public.api_keys for all using (
  public.member_role_in_org(organization_id) in ('owner', 'admin', 'manager')
) with check (
  public.member_role_in_org(organization_id) in ('owner', 'admin', 'manager')
);

drop policy if exists workflow_templates_org on public.workflow_templates;
create policy workflow_templates_org on public.workflow_templates
  for all using (public.is_org_member(organization_id))
  with check (public.can_manage_organization(organization_id));

drop policy if exists workflow_steps_org on public.workflow_steps;
create policy workflow_steps_org on public.workflow_steps
  for all using (public.is_org_member(organization_id))
  with check (public.can_manage_organization(organization_id));

drop policy if exists job_workflow_progress_org on public.job_workflow_progress;
create policy job_workflow_progress_org on public.job_workflow_progress
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists departments_org on public.departments;
create policy departments_org on public.departments
  for all using (public.is_org_member(organization_id))
  with check (public.can_manage_organization(organization_id));

drop policy if exists department_memberships_org on public.department_memberships;
create policy department_memberships_org on public.department_memberships
  for all using (public.is_org_member(organization_id))
  with check (public.can_manage_organization(organization_id));

-- ---------------------------------------------------------------------------
-- 11. Storage buckets and policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-photos', 'job-photos', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('org-logos', 'org-logos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists job_photos_storage_select on storage.objects;
create policy job_photos_storage_select on storage.objects for select using (
  bucket_id = 'job-photos' and (
    auth.uid()::text = (storage.foldername(name))[1]
    or exists (
      select 1 from public.job_photos jp join public.jobs j on j.id = jp.job_id
      where jp.storage_path = name and (public.is_assigned_to_job(j.id) or public.client_can_view_job(j.id))
    )
  )
);

drop policy if exists job_photos_storage_insert on storage.objects;
create policy job_photos_storage_insert on storage.objects for insert with check (
  bucket_id = 'job-photos' and (
    auth.uid()::text = (storage.foldername(name))[1]
    or exists (
      select 1 from public.jobs j
      where j.user_id::text = (storage.foldername(name))[1]
        and j.id::text = (storage.foldername(name))[2]
        and public.is_assigned_to_job(j.id)
    )
  )
);

drop policy if exists job_photos_storage_update on storage.objects;
create policy job_photos_storage_update on storage.objects for update using (
  bucket_id = 'job-photos' and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists job_photos_storage_delete on storage.objects;
create policy job_photos_storage_delete on storage.objects for delete using (
  bucket_id = 'job-photos' and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists org_logos_select on storage.objects;
create policy org_logos_select on storage.objects for select using (
  bucket_id = 'org-logos' and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
);

drop policy if exists org_logos_insert on storage.objects;
create policy org_logos_insert on storage.objects for insert with check (
  bucket_id = 'org-logos' and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
);

drop policy if exists org_logos_update on storage.objects;
create policy org_logos_update on storage.objects for update using (
  bucket_id = 'org-logos' and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
);

drop policy if exists org_logos_delete on storage.objects;
create policy org_logos_delete on storage.objects for delete using (
  bucket_id = 'org-logos' and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
);

-- ---------------------------------------------------------------------------
-- 12. Backfill organizations for existing auth users (no-op on empty DB)
-- ---------------------------------------------------------------------------
do $$
declare r record; oid uuid;
begin
  for r in
    select p.id as uid, coalesce(p.business_name, bp.business_name, 'My Business') as bname
    from public.profiles p
    left join public.business_profiles bp on bp.user_id = p.id
    where p.organization_id is null
  loop
    insert into public.organizations (name, owner_user_id) values (r.bname, r.uid) returning id into oid;
    insert into public.organization_members (organization_id, user_id, role, active)
    values (oid, r.uid, 'owner', true) on conflict do nothing;
    insert into public.organization_settings (organization_id) values (oid) on conflict do nothing;
    update public.profiles set organization_id = oid where id = r.uid;
    update public.customers set organization_id = oid where user_id = r.uid and organization_id is null;
    update public.workers set organization_id = oid where user_id = r.uid and organization_id is null;
    update public.jobs set organization_id = oid where user_id = r.uid and organization_id is null;
  end loop;
end $$;

-- Done
select 'EverittOS full setup complete' as status;
