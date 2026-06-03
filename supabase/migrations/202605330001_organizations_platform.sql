-- Organizations, team, expanded plans, activity, notifications, org-scoped RLS

-- ---------------------------------------------------------------------------
-- Plan tier limits (seeded; triggers read caps from here — no hardcoded caps)
-- ---------------------------------------------------------------------------
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
  ('free', 10, 100, 25, 3, 1, 0, 1, false, false, true, false, false, false, false, false, true),
  ('pro', -1, -1, -1, 25, 1, 0, 1, false, false, true, false, false, false, false, false, true),
  ('business', -1, -1, -1, -1, -1, 100, 1, true, true, true, true, false, false, false, false, true),
  ('starter', -1, -1, -1, 50, 5, 25, 1, true, true, true, true, false, false, false, false, true),
  ('growth', -1, -1, -1, -1, 25, 100, 3, true, true, true, true, true, true, false, false, true),
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

alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check
  check (plan in ('free', 'pro', 'business', 'starter', 'growth', 'enterprise'));

alter table public.everittos_subscriptions drop constraint if exists everittos_subscriptions_plan_check;
alter table public.everittos_subscriptions add constraint everittos_subscriptions_plan_check
  check (plan in ('pro', 'business', 'starter', 'growth', 'enterprise'));

-- ---------------------------------------------------------------------------
-- Organizations
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
  service_type text,
  booking_url text,
  notification_assignments boolean default true,
  notification_due_dates boolean default true,
  notification_completions boolean default true,
  notification_reports boolean default true,
  brand_primary_color text,
  brand_accent_color text,
  enterprise_onboarding_notes text,
  updated_at timestamptz default now()
);

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
  role text not null default 'staff' check (role in ('owner', 'admin', 'manager', 'crew_lead', 'staff')),
  active boolean not null default true,
  created_at timestamptz default now(),
  unique (organization_id, user_id)
);

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role text not null default 'staff' check (role in ('admin', 'manager', 'crew_lead', 'staff')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists organization_members_org_idx on public.organization_members (organization_id);
create index if not exists organization_members_user_idx on public.organization_members (user_id);
create index if not exists organization_invitations_email_idx on public.organization_invitations (email);

alter table public.profiles
  add column if not exists organization_id uuid references public.organizations (id) on delete set null;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('owner', 'admin', 'manager', 'crew_lead', 'staff', 'client'));

update public.profiles set role = 'crew_lead' where role = 'contractor';

-- Org columns on tenant tables
alter table public.customers add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.workers add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.jobs add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.job_photos add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.job_reports add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.job_timeline add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.job_assignments add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.crews add column if not exists organization_id uuid references public.organizations (id) on delete cascade;

alter table public.jobs
  add column if not exists priority text default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  add column if not exists internal_notes text,
  add column if not exists customer_notes text,
  add column if not exists completion_verified boolean default false,
  add column if not exists property_id uuid;

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

alter table public.jobs
  add constraint jobs_property_id_fkey foreign key (property_id) references public.customer_properties (id) on delete set null;

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

alter table public.job_photos drop constraint if exists job_photos_label_check;
alter table public.job_photos add constraint job_photos_label_check
  check (label in ('before', 'progress', 'during', 'after', 'other'));

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

create index if not exists activity_logs_org_idx on public.activity_logs (organization_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('assignment', 'due_date', 'completion', 'report')),
  title text not null,
  body text,
  read_at timestamptz,
  related_job_id uuid references public.jobs (id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, read_at);

-- Backfill organizations for existing owners
insert into public.organizations (id, name, owner_user_id)
select gen_random_uuid(), coalesce(p.business_name, 'My Business'), p.id
from public.profiles p
where not exists (
  select 1 from public.organization_members om where om.user_id = p.id and om.role = 'owner'
)
on conflict do nothing;

-- Simpler backfill: one org per profile without org membership
do $$
declare
  r record;
  oid uuid;
begin
  for r in
    select p.id as uid, coalesce(p.business_name, bp.business_name, 'My Business') as bname
    from public.profiles p
    left join public.business_profiles bp on bp.user_id = p.id
    where p.organization_id is null
  loop
    insert into public.organizations (name, owner_user_id)
    values (r.bname, r.uid)
    returning id into oid;

    insert into public.organization_members (organization_id, user_id, role, active)
    values (oid, r.uid, 'owner', true)
    on conflict do nothing;

    insert into public.organization_settings (organization_id)
    values (oid)
    on conflict do nothing;

    update public.profiles set organization_id = oid where id = r.uid;

    update public.customers set organization_id = oid where user_id = r.uid and organization_id is null;
    update public.workers set organization_id = oid where user_id = r.uid and organization_id is null;
    update public.jobs set organization_id = oid where user_id = r.uid and organization_id is null;
    update public.job_photos jp set organization_id = j.organization_id
    from public.jobs j where jp.job_id = j.id and jp.organization_id is null;
    update public.job_reports jr set organization_id = j.organization_id
    from public.jobs j where jr.job_id = j.id and jr.organization_id is null;
    update public.job_timeline jt set organization_id = j.organization_id
    from public.jobs j where jt.job_id = j.id and jt.organization_id is null;
    update public.job_assignments ja set organization_id = j.organization_id
    from public.jobs j where ja.job_id = j.id and ja.organization_id is null;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Org helpers
-- ---------------------------------------------------------------------------
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

create or replace function public.current_user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.organization_members
  where user_id = auth.uid() and active = true;
$$;

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

-- Activity logger
create or replace function public.log_activity(
  p_org_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_message text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (select activity_log from public.plan_tier_limits where plan_id = public.plan_for_organization(p_org_id)) then
    return;
  end if;
  insert into public.activity_logs (organization_id, user_id, actor_name, entity_type, entity_id, action, message, metadata)
  values (
    p_org_id,
    auth.uid(),
    (select coalesce(full_name, email) from public.profiles where id = auth.uid()),
    p_entity_type,
    p_entity_id,
    p_action,
    p_message,
    p_metadata
  );
end;
$$;

-- Plan enforcement (org-scoped, reads plan_tier_limits)
create or replace function public.enforce_org_resource_limit(
  p_org_id uuid,
  p_resource text,
  p_table text,
  p_extra_filter text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p text;
  cap int;
  cnt int;
  sql text;
begin
  p := public.plan_for_organization(p_org_id);
  cap := public.plan_limit_cap(p, p_resource);
  if cap < 0 then
    return;
  end if;
  sql := format('select count(*)::int from public.%I where organization_id = $1', p_table);
  if p_extra_filter <> '' then
    sql := sql || ' and ' || p_extra_filter;
  end if;
  execute sql into cnt using p_org_id;
  if cnt >= cap then
    raise exception 'PLAN_LIMIT_%', upper(p_resource);
  end if;
end;
$$;

create or replace function public.enforce_job_insert_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  oid uuid;
begin
  oid := coalesce(new.organization_id, (select organization_id from public.profiles where id = new.user_id));
  perform public.enforce_org_resource_limit(oid, 'customers', 'customers');
  return new;
end;
$$;

create or replace function public.enforce_photo_insert_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  oid uuid;
begin
  oid := coalesce(new.organization_id, (select organization_id from public.profiles where id = new.user_id));
  perform public.enforce_org_resource_limit(oid, 'photos', 'job_photos');
  return new;
end;
$$;

create or replace function public.enforce_report_insert_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  oid uuid;
  p text;
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
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  oid uuid;
  p text;
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
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'owner' then
    return new;
  end if;
  if not (select team_management from public.plan_tier_limits where plan_id = public.plan_for_organization(new.organization_id)) then
    raise exception 'PLAN_REQUIRES_TEAM';
  end if;
  perform public.enforce_org_resource_limit(new.organization_id, 'team_members', 'organization_members', 'active = true');
  return new;
end;
$$;

drop trigger if exists organization_members_team_limit on public.organization_members;
create trigger organization_members_team_limit
before insert on public.organization_members
for each row execute function public.enforce_team_member_insert();

-- Auto-set organization_id on insert
create or replace function public.set_row_organization_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  oid uuid;
begin
  if new.organization_id is not null then
    return new;
  end if;
  select organization_id into oid from public.profiles where id = new.user_id;
  if oid is not null then
    new.organization_id := oid;
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_set_org on public.jobs;
create trigger jobs_set_org before insert on public.jobs
for each row execute function public.set_row_organization_id();

drop trigger if exists customers_set_org on public.customers;
create trigger customers_set_org before insert on public.customers
for each row execute function public.set_row_organization_id();

drop trigger if exists workers_set_org on public.workers;
create trigger workers_set_org before insert on public.workers
for each row execute function public.set_row_organization_id();

-- RLS enable new tables
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

-- plan_tier_limits: read-only for authenticated
drop policy if exists plan_tier_limits_read on public.plan_tier_limits;
create policy plan_tier_limits_read on public.plan_tier_limits for select to authenticated using (true);

-- Organizations: members can read; owner/admin can update
drop policy if exists organizations_member_select on public.organizations;
create policy organizations_member_select on public.organizations
  for select using (public.is_org_member(id));

drop policy if exists organizations_owner_update on public.organizations;
create policy organizations_owner_update on public.organizations
  for update using (public.member_role_in_org(id) in ('owner', 'admin'))
  with check (public.member_role_in_org(id) in ('owner', 'admin'));

drop policy if exists organizations_owner_insert on public.organizations;
create policy organizations_owner_insert on public.organizations
  for insert with check (auth.uid() = owner_user_id);

-- Organization settings
drop policy if exists organization_settings_member on public.organization_settings;
create policy organization_settings_member on public.organization_settings
  for all using (public.is_org_member(organization_id))
  with check (public.can_manage_organization(organization_id));

-- Members
drop policy if exists organization_members_select on public.organization_members;
create policy organization_members_select on public.organization_members
  for select using (public.is_org_member(organization_id));

drop policy if exists organization_members_manage on public.organization_members;
create policy organization_members_manage on public.organization_members
  for all using (public.member_role_in_org(organization_id) in ('owner', 'admin'))
  with check (public.member_role_in_org(organization_id) in ('owner', 'admin'));

-- Invitations
drop policy if exists organization_invitations_select on public.organization_invitations;
create policy organization_invitations_select on public.organization_invitations
  for select using (
    public.member_role_in_org(organization_id) in ('owner', 'admin', 'manager')
    or lower(email) = lower(coalesce((select email from public.profiles where id = auth.uid()), ''))
  );

drop policy if exists organization_invitations_manage on public.organization_invitations;
create policy organization_invitations_manage on public.organization_invitations
  for all using (public.member_role_in_org(organization_id) in ('owner', 'admin', 'manager'))
  with check (public.member_role_in_org(organization_id) in ('owner', 'admin', 'manager'));

-- Locations (enterprise)
drop policy if exists organization_locations_member on public.organization_locations;
create policy organization_locations_member on public.organization_locations
  for all using (public.is_org_member(organization_id))
  with check (public.can_manage_organization(organization_id));

-- Org-scoped data policies (jobs example — extend pattern)
drop policy if exists jobs_org_select on public.jobs;
create policy jobs_org_select on public.jobs
  for select using (
    (organization_id is not null and public.is_org_member(organization_id))
    or auth.uid() = user_id
  );

drop policy if exists jobs_org_write on public.jobs;
create policy jobs_org_write on public.jobs
  for all using (
    (organization_id is not null and public.can_manage_organization(organization_id))
    or auth.uid() = user_id
  )
  with check (
    (organization_id is not null and public.can_manage_organization(organization_id))
    or auth.uid() = user_id
  );

drop policy if exists customers_org on public.customers;
create policy customers_org on public.customers
  for all using (
    (organization_id is not null and public.is_org_member(organization_id))
    or auth.uid() = user_id
  )
  with check (
    (organization_id is not null and public.can_manage_organization(organization_id))
    or auth.uid() = user_id
  );

drop policy if exists workers_org on public.workers;
create policy workers_org on public.workers
  for all using (
    (organization_id is not null and public.is_org_member(organization_id))
    or auth.uid() = user_id
  )
  with check (
    (organization_id is not null and public.can_manage_organization(organization_id))
    or auth.uid() = user_id
  );

drop policy if exists job_photos_org on public.job_photos;
create policy job_photos_org on public.job_photos
  for all using (
    (organization_id is not null and public.is_org_member(organization_id))
    or auth.uid() = user_id
  )
  with check (
    (organization_id is not null and public.is_org_member(organization_id))
    or auth.uid() = user_id
  );

drop policy if exists job_reports_org on public.job_reports;
create policy job_reports_org on public.job_reports
  for all using (
    (organization_id is not null and public.is_org_member(organization_id))
    or auth.uid() = user_id
  )
  with check (
    (organization_id is not null and public.is_org_member(organization_id))
    or auth.uid() = user_id
  );

drop policy if exists activity_logs_org on public.activity_logs;
create policy activity_logs_org on public.activity_logs
  for select using (public.is_org_member(organization_id));

drop policy if exists activity_logs_insert on public.activity_logs;
create policy activity_logs_insert on public.activity_logs
  for insert with check (public.is_org_member(organization_id));

drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists customer_properties_org on public.customer_properties;
create policy customer_properties_org on public.customer_properties
  for all using (public.is_org_member(organization_id))
  with check (public.can_manage_organization(organization_id));

drop policy if exists job_checklist_org on public.job_checklist_items;
create policy job_checklist_org on public.job_checklist_items
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- Logo storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('org-logos', 'org-logos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists org_logos_select on storage.objects;
create policy org_logos_select on storage.objects
  for select using (
    bucket_id = 'org-logos'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
  );

drop policy if exists org_logos_insert on storage.objects;
create policy org_logos_insert on storage.objects
  for insert with check (
    bucket_id = 'org-logos'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
  );

drop policy if exists org_logos_update on storage.objects;
create policy org_logos_update on storage.objects
  for update using (
    bucket_id = 'org-logos'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
  );

drop policy if exists org_logos_delete on storage.objects;
create policy org_logos_delete on storage.objects
  for delete using (
    bucket_id = 'org-logos'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
  );
