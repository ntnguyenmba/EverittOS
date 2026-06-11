-- =============================================================================
-- EverittOS production auth schema repair
-- Paste this ENTIRE script into Supabase Dashboard → SQL Editor → Run once.
--
-- Safe: idempotent, no table drops, no data deletion.
-- Fixes login bootstrap, signup profile creation, forgot-password session load,
-- dashboard guards, organization membership, and plan/subscription checks.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. profiles (login bootstrap + middleware)
-- -----------------------------------------------------------------------------
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
  account_status text default 'active',
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
alter table public.profiles add column if not exists account_status text default 'active';
alter table public.profiles add column if not exists reroot_report_access boolean default false;
alter table public.profiles add column if not exists reroot_premium_until timestamptz;
alter table public.profiles add column if not exists created_at timestamptz default now();

update public.profiles set role = 'owner' where role is null or trim(role) = '';
update public.profiles set plan = 'free' where plan is null or trim(plan) = '';
update public.profiles set subscription_status = 'free' where subscription_status is null or trim(subscription_status) = '';
update public.profiles set account_status = 'active' where account_status is null or trim(account_status) = '';

update public.profiles set role = 'employee' where lower(role) = 'staff';
update public.profiles set role = 'contractor' where lower(role) in ('crew_lead', 'crew-lead');

alter table public.profiles alter column account_status set default 'active';

create index if not exists profiles_account_status_idx on public.profiles (account_status);
create index if not exists profiles_organization_id_idx on public.profiles (organization_id);

-- -----------------------------------------------------------------------------
-- 2. business_profiles (signup + bootstrap)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 3. organizations + membership (login bootstrap + dashboard guard)
-- -----------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  parent_organization_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.organizations add column if not exists parent_organization_id uuid;
alter table public.organizations add column if not exists created_at timestamptz default now();
alter table public.organizations add column if not exists updated_at timestamptz default now();

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
alter table public.organization_settings add column if not exists updated_at timestamptz default now();
alter table public.organization_settings add column if not exists timezone text default 'UTC';

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner',
  active boolean not null default true,
  created_at timestamptz default now(),
  unique (organization_id, user_id)
);

alter table public.organization_members add column if not exists role text default 'owner';
alter table public.organization_members add column if not exists active boolean not null default true;
alter table public.organization_members add column if not exists created_at timestamptz default now();

update public.organization_members set active = true where active is null;
update public.organization_members set role = 'owner' where role is null or trim(role) = '';
update public.organization_members set role = 'employee' where lower(role) = 'staff';
update public.organization_members set role = 'contractor' where lower(role) in ('crew_lead', 'crew-lead');

create index if not exists organization_members_org_idx on public.organization_members (organization_id);
create index if not exists organization_members_user_idx on public.organization_members (user_id);

alter table public.profiles drop constraint if exists profiles_organization_id_fkey;
alter table public.profiles
  add constraint profiles_organization_id_fkey
  foreign key (organization_id) references public.organizations (id) on delete set null;

-- -----------------------------------------------------------------------------
-- 4. subscriptions + plan limits (billing / middleware plan checks)
-- -----------------------------------------------------------------------------
create table if not exists public.everittos_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  plan text not null default 'pro',
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

alter table public.everittos_subscriptions add column if not exists user_id uuid;
alter table public.everittos_subscriptions add column if not exists cancelled_at timestamptz;
alter table public.everittos_subscriptions add column if not exists last_payment_status text;
alter table public.everittos_subscriptions add column if not exists updated_at timestamptz default now();

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

insert into public.plan_tier_limits (
  plan_id, jobs_cap, photos_cap, customers_cap, reports_cap, team_members_cap, crew_members_cap, locations_cap,
  crew_assignment, team_management, scheduling, activity_log, advanced_reporting, workflow_customization,
  multi_location, custom_branding, pdf_reports
) values
  ('free', 3, 0, 10, 10, 1, 0, 1, false, false, true, false, false, false, false, false, true),
  ('pro', 25, -1, 100, -1, 3, 0, 1, false, false, true, false, false, false, false, false, true),
  ('business', 150, -1, 1000, -1, 15, 100, 1, true, true, true, true, false, false, false, false, true),
  ('operations', 500, -1, 5000, -1, 50, 200, 5, true, true, true, true, true, false, false, true, true),
  ('growth', 2500, -1, 25000, -1, 250, -1, 25, true, true, true, true, true, true, true, true, true),
  ('enterprise', -1, -1, -1, -1, -1, -1, -1, true, true, true, true, true, true, true, true, true)
on conflict (plan_id) do nothing;

-- -----------------------------------------------------------------------------
-- 5. constraints (after data normalization)
-- -----------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check
  check (plan in ('free', 'pro', 'business', 'operations', 'growth', 'enterprise'));

alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check
  check (account_status in ('active', 'disabled'));

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('owner', 'admin', 'manager', 'employee', 'contractor', 'client', 'viewer'));

alter table public.organization_members drop constraint if exists organization_members_role_check;
alter table public.organization_members add constraint organization_members_role_check
  check (role in ('owner', 'admin', 'manager', 'employee', 'contractor', 'client', 'viewer'));

-- -----------------------------------------------------------------------------
-- 6. auth helper functions
-- -----------------------------------------------------------------------------
create or replace function public.current_user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.organization_members
  where user_id = auth.uid() and active = true;
$$;

create or replace function public.member_role_in_org(org_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.organization_members
  where organization_id = org_id and user_id = auth.uid() and active = true
  limit 1;
$$;

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = org_id and user_id = auth.uid() and active = true
  );
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

create or replace function public.plan_for_organization(org_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.plan, 'free')
  from public.organizations o
  join public.profiles p on p.id = o.owner_user_id
  where o.id = org_id;
$$;

create or replace function public.plan_limit_cap(p_plan text, p_resource text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case p_resource
    when 'jobs' then jobs_cap
    when 'photos' then photos_cap
    when 'customers' then customers_cap
    when 'reports' then reports_cap
    when 'team_members' then team_members_cap
    when 'crew_members' then crew_members_cap
    when 'locations' then locations_cap
    else -1
  end
  from public.plan_tier_limits
  where plan_id = coalesce(p_plan, 'free');
$$;

-- -----------------------------------------------------------------------------
-- 7. signup trigger (auth.users → profiles + business_profiles)
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, plan, subscription_status, account_status, business_name)
  values (
    new.id,
    new.email,
    'owner',
    'free',
    'free',
    'active',
    coalesce(new.raw_user_meta_data->>'business_name', split_part(coalesce(new.email, ''), '@', 1), 'My Business')
  )
  on conflict (id) do update set
    email = excluded.email,
    role = coalesce(nullif(trim(public.profiles.role), ''), excluded.role),
    plan = coalesce(public.profiles.plan, excluded.plan, 'free'),
    subscription_status = coalesce(public.profiles.subscription_status, excluded.subscription_status, 'free'),
    account_status = coalesce(public.profiles.account_status, excluded.account_status, 'active');

  insert into public.business_profiles (user_id, business_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'business_name', split_part(coalesce(new.email, ''), '@', 1), 'My Business'),
    new.email
  )
  on conflict (user_id) do update set
    email = excluded.email,
    business_name = coalesce(nullif(trim(public.business_profiles.business_name), ''), excluded.business_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 8. RLS policies required by login/session/middleware
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.business_profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_settings enable row level security;
alter table public.organization_members enable row level security;
alter table public.everittos_subscriptions enable row level security;
alter table public.plan_tier_limits enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);

drop policy if exists business_profiles_own on public.business_profiles;
create policy business_profiles_own on public.business_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists organizations_member_select on public.organizations;
create policy organizations_member_select on public.organizations
  for select using (public.is_org_member(id));

drop policy if exists organizations_owner_insert on public.organizations;
create policy organizations_owner_insert on public.organizations
  for insert with check (auth.uid() = owner_user_id);

drop policy if exists organizations_owner_update on public.organizations;
create policy organizations_owner_update on public.organizations
  for update using (public.member_role_in_org(id) in ('owner', 'admin'))
  with check (public.member_role_in_org(id) in ('owner', 'admin'));

drop policy if exists organization_settings_member on public.organization_settings;
drop policy if exists organization_settings_select on public.organization_settings;
create policy organization_settings_select on public.organization_settings
  for select using (public.is_org_member(organization_id));

drop policy if exists organization_settings_insert on public.organization_settings;
create policy organization_settings_insert on public.organization_settings
  for insert with check (public.member_role_in_org(organization_id) in ('owner', 'admin'));

drop policy if exists organization_settings_update on public.organization_settings;
create policy organization_settings_update on public.organization_settings
  for update
  using (public.member_role_in_org(organization_id) in ('owner', 'admin'))
  with check (public.member_role_in_org(organization_id) in ('owner', 'admin'));

drop policy if exists organization_settings_delete on public.organization_settings;
create policy organization_settings_delete on public.organization_settings
  for delete using (public.member_role_in_org(organization_id) in ('owner', 'admin'));

drop policy if exists organization_members_select on public.organization_members;
create policy organization_members_select on public.organization_members
  for select using (public.is_org_member(organization_id));

drop policy if exists organization_members_manage on public.organization_members;
create policy organization_members_manage on public.organization_members
  for all using (public.member_role_in_org(organization_id) in ('owner', 'admin'))
  with check (public.member_role_in_org(organization_id) in ('owner', 'admin'));

drop policy if exists everittos_subscriptions_select on public.everittos_subscriptions;
create policy everittos_subscriptions_select on public.everittos_subscriptions
  for select using (
    auth.uid() = user_id
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists plan_tier_limits_read on public.plan_tier_limits;
create policy plan_tier_limits_read on public.plan_tier_limits for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- 9. backfill workspace for every existing auth user missing profile/org access
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
  v_org_id uuid;
  v_business_name text;
begin
  for r in
    select
      u.id as user_id,
      lower(trim(u.email)) as email,
      coalesce(nullif(trim(p.business_name), ''), split_part(lower(trim(u.email)), '@', 1), 'My Business') as business_name,
      coalesce(nullif(trim(p.role), ''), 'owner') as role_name,
      p.organization_id as profile_org_id
    from auth.users u
    left join public.profiles p on p.id = u.id
  loop
    insert into public.profiles (
      id, email, role, plan, subscription_status, account_status, business_name
    )
    values (
      r.user_id,
      r.email,
      r.role_name,
      'free',
      'free',
      'active',
      r.business_name
    )
    on conflict (id) do update set
      email = coalesce(excluded.email, public.profiles.email),
      role = coalesce(nullif(trim(public.profiles.role), ''), excluded.role, 'owner'),
      plan = coalesce(public.profiles.plan, excluded.plan, 'free'),
      subscription_status = coalesce(public.profiles.subscription_status, excluded.subscription_status, 'free'),
      account_status = coalesce(public.profiles.account_status, excluded.account_status, 'active'),
      business_name = coalesce(nullif(trim(public.profiles.business_name), ''), excluded.business_name);

    insert into public.business_profiles (user_id, business_name, email)
    values (r.user_id, r.business_name, r.email)
    on conflict (user_id) do update set
      business_name = coalesce(nullif(trim(public.business_profiles.business_name), ''), excluded.business_name),
      email = coalesce(excluded.email, public.business_profiles.email);

    v_org_id := r.profile_org_id;

    if v_org_id is null then
      select om.organization_id into v_org_id
      from public.organization_members om
      where om.user_id = r.user_id and om.active = true
      order by om.created_at asc nulls last
      limit 1;
    end if;

    if v_org_id is null then
      insert into public.organizations (name, owner_user_id)
      values (r.business_name, r.user_id)
      returning id into v_org_id;
    end if;

    insert into public.organization_members (organization_id, user_id, role, active)
    values (v_org_id, r.user_id, r.role_name, true)
    on conflict (organization_id, user_id) do update set
      role = excluded.role,
      active = true;

    update public.profiles
    set organization_id = v_org_id,
        role = r.role_name,
        account_status = coalesce(account_status, 'active')
    where id = r.user_id;

    insert into public.organization_settings (organization_id)
    values (v_org_id)
    on conflict (organization_id) do nothing;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 10. verification (safe to keep in output)
-- -----------------------------------------------------------------------------
select 'profiles columns' as check_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in ('plan', 'subscription_status', 'account_status', 'organization_id', 'role', 'email', 'business_name')
order by column_name;

select
  p.id,
  p.email,
  p.role,
  p.plan,
  p.account_status,
  p.organization_id,
  om.role as member_role,
  om.active as membership_active
from public.profiles p
left join public.organization_members om
  on om.user_id = p.id
 and om.organization_id = p.organization_id
where p.id = '271db5bf-ac35-4478-b3f4-94f5740563c5';
