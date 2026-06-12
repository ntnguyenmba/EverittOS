-- Align workspace bootstrap constraints and required profile columns for signup/login repair.
-- Requires organizations table from 202605330001_organizations_platform.sql.
-- Service-role bootstrap bypasses RLS; this migration does not change RLS policies.

update public.profiles
set role = 'owner'
where role is null or trim(role) = '';

update public.organization_members
set role = 'owner'
where role is null or trim(role) = '';

alter table public.profiles
  add column if not exists account_status text not null default 'active';

alter table public.profiles
  add column if not exists organization_id uuid references public.organizations (id) on delete set null;

alter table public.profiles
  add column if not exists plan text default 'free';

alter table public.profiles
  add column if not exists subscription_status text default 'free';

alter table public.profiles
  add column if not exists business_name text;

alter table public.profiles
  add column if not exists email text;

alter table public.profiles
  add column if not exists role text default 'owner';

alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check
  check (account_status in ('active', 'disabled'));

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('owner', 'admin', 'manager', 'employee', 'contractor', 'client', 'viewer', 'crew_lead', 'staff'));

alter table public.organization_members drop constraint if exists organization_members_role_check;
alter table public.organization_members add constraint organization_members_role_check
  check (role in ('owner', 'admin', 'manager', 'employee', 'contractor', 'client', 'viewer', 'crew_lead', 'staff'));

alter table public.organization_settings
  add column if not exists onboarding_step int not null default 0;

alter table public.organization_settings
  add column if not exists onboarding_completed boolean not null default false;

alter table public.organization_settings
  add column if not exists onboarding_skipped boolean not null default false;

create index if not exists organizations_owner_user_id_idx on public.organizations (owner_user_id);
