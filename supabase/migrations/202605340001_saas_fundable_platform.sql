-- Fundable SaaS: Operations plan, aligned limits, onboarding, analytics, role updates

-- Rename starter -> operations in data
update public.profiles set plan = 'operations' where plan = 'starter';
update public.everittos_subscriptions set plan = 'operations' where plan = 'starter';
delete from public.plan_tier_limits where plan_id = 'starter';

alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check
  check (plan in ('free', 'pro', 'business', 'operations', 'growth', 'enterprise'));

alter table public.everittos_subscriptions drop constraint if exists everittos_subscriptions_plan_check;
alter table public.everittos_subscriptions add constraint everittos_subscriptions_plan_check
  check (plan in ('pro', 'business', 'operations', 'growth', 'enterprise'));

alter table public.organization_members drop constraint if exists organization_members_role_check;
alter table public.organization_members add constraint organization_members_role_check
  check (role in ('owner', 'manager', 'employee', 'contractor', 'client', 'admin', 'crew_lead', 'staff'));

alter table public.organization_invitations drop constraint if exists organization_invitations_role_check;
alter table public.organization_invitations add constraint organization_invitations_role_check
  check (role in ('manager', 'employee', 'contractor', 'client', 'admin', 'crew_lead', 'staff'));

alter table public.organization_settings
  add column if not exists industry text,
  add column if not exists team_size text,
  add column if not exists website text,
  add column if not exists onboarding_step int not null default 0,
  add column if not exists onboarding_completed boolean not null default false;

-- Re-seed plan limits (must match lib/plan-config.ts)
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

-- Photo limit: block free tier at DB level
create or replace function public.enforce_photo_insert_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  oid uuid;
  p text;
  photo_cap int;
begin
  oid := coalesce(new.organization_id, (select organization_id from public.profiles where id = new.user_id));
  p := public.plan_for_organization(oid);
  photo_cap := public.plan_limit_cap(p, 'photos');
  if photo_cap = 0 then
    raise exception 'PLAN_REQUIRES_PRO_PHOTOS';
  end if;
  if photo_cap < 0 then
    return new;
  end if;
  perform public.enforce_org_resource_limit(oid, 'photos', 'job_photos');
  return new;
end;
$$;

-- Product analytics (internal)
create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  event_name text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists product_events_org_idx on public.product_events (organization_id, created_at desc);

alter table public.product_events enable row level security;

drop policy if exists product_events_insert on public.product_events;
create policy product_events_insert on public.product_events
  for insert with check (
    organization_id is null
    or public.is_org_member(organization_id)
  );

drop policy if exists product_events_select on public.product_events;
create policy product_events_select on public.product_events
  for select using (
    organization_id is not null and public.member_role_in_org(organization_id) in ('owner', 'manager')
  );
