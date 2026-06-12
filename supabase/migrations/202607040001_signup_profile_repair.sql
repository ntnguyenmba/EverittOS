-- Repair signup/profile provisioning for production.
-- Fixes: auth trigger blocked by RLS on public.profiles during signup.
-- Safe to re-run. Does not wipe data.

-- ---------------------------------------------------------------------------
-- 1. Ensure required profile / org columns exist
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists email text;

alter table public.profiles
  add column if not exists full_name text;

alter table public.profiles
  add column if not exists role text default 'owner';

alter table public.profiles
  add column if not exists plan text default 'free';

alter table public.profiles
  add column if not exists subscription_status text default 'free';

alter table public.profiles
  add column if not exists account_status text not null default 'active';

alter table public.profiles
  add column if not exists business_name text;

alter table public.profiles
  add column if not exists organization_id uuid;

alter table public.profiles
  add column if not exists created_at timestamptz default now();

alter table public.profiles
  add column if not exists deleted_at timestamptz;

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;

alter table public.profiles
  add column if not exists preferred_locale text default 'en';

alter table public.profiles
  add column if not exists locale text default 'en';

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'organizations'
  ) and not exists (
    select 1 from pg_constraint where conname = 'profiles_organization_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_organization_id_fkey
      foreign key (organization_id) references public.organizations (id) on delete set null;
  end if;
exception when others then
  raise notice 'profiles_organization_id_fkey skipped: %', sqlerrm;
end $$;

alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check
  check (account_status in ('active', 'disabled'));

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('owner', 'admin', 'manager', 'employee', 'contractor', 'client', 'viewer', 'crew_lead', 'staff'));

-- ---------------------------------------------------------------------------
-- 2. Workspace provisioning (SECURITY DEFINER — bypasses RLS for signup)
-- ---------------------------------------------------------------------------
create or replace function public.provision_user_workspace(
  p_user_id uuid,
  p_email text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_business_name text;
  v_full_name text;
  v_role text := 'owner';
  v_company_id uuid;
  v_has_company_id_col boolean;
  v_has_companies_table boolean;
begin
  if p_user_id is null then
    raise exception 'provision_user_workspace: user id is required';
  end if;

  v_full_name := coalesce(
    nullif(trim(p_metadata->>'full_name'), ''),
    nullif(trim(p_metadata->>'name'), ''),
    null
  );

  v_business_name := coalesce(
    nullif(trim(p_metadata->>'business_name'), ''),
    v_full_name,
    nullif(trim(split_part(coalesce(p_email, ''), '@', 1)), ''),
    'My Business'
  );

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    plan,
    subscription_status,
    account_status,
    business_name
  )
  values (
    p_user_id,
    p_email,
    v_full_name,
    v_role,
    'free',
    'free',
    'active',
    v_business_name
  )
  on conflict (id) do update set
    email = coalesce(excluded.email, public.profiles.email),
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    role = coalesce(nullif(trim(public.profiles.role), ''), excluded.role),
    plan = coalesce(public.profiles.plan, excluded.plan, 'free'),
    subscription_status = coalesce(
      public.profiles.subscription_status,
      excluded.subscription_status,
      'free'
    ),
    account_status = coalesce(public.profiles.account_status, excluded.account_status, 'active'),
    business_name = coalesce(nullif(trim(public.profiles.business_name), ''), excluded.business_name);

  insert into public.business_profiles (user_id, business_name, email)
  values (p_user_id, v_business_name, p_email)
  on conflict (user_id) do update set
    email = coalesce(excluded.email, public.business_profiles.email),
    business_name = coalesce(
      nullif(trim(public.business_profiles.business_name), ''),
      excluded.business_name
    );

  select organization_id into v_org_id
  from public.profiles
  where id = p_user_id;

  if v_org_id is null then
    select om.organization_id into v_org_id
    from public.organization_members om
    where om.user_id = p_user_id
      and om.active = true
    order by om.created_at asc nulls last
    limit 1;
  end if;

  if v_org_id is null then
    select o.id into v_org_id
    from public.organizations o
    where o.owner_user_id = p_user_id
    order by o.created_at asc nulls last
    limit 1;
  end if;

  if v_org_id is null then
    insert into public.organizations (name, owner_user_id)
    values (v_business_name, p_user_id)
    returning id into v_org_id;
  end if;

  insert into public.organization_settings (organization_id)
  values (v_org_id)
  on conflict (organization_id) do nothing;

  insert into public.organization_members (organization_id, user_id, role, active)
  values (v_org_id, p_user_id, v_role, true)
  on conflict (organization_id, user_id) do update set
    role = excluded.role,
    active = true;

  update public.profiles
  set organization_id = v_org_id,
      role = v_role
  where id = p_user_id
    and (
      organization_id is distinct from v_org_id
      or role is distinct from v_role
    );

  -- Legacy company_id on profiles (optional production column)
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'company_id'
  ) into v_has_company_id_col;

  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'companies'
  ) into v_has_companies_table;

  if v_has_company_id_col and v_has_companies_table then
    v_company_id := null;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'companies' and column_name = 'owner_id'
    ) then
      select c.id into v_company_id
      from public.companies c
      where c.owner_id = p_user_id
      order by c.id
      limit 1;
    end if;

    if v_company_id is null and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'companies' and column_name = 'user_id'
    ) then
      select c.id into v_company_id
      from public.companies c
      where c.user_id = p_user_id
      order by c.id
      limit 1;
    end if;

    if v_company_id is not null then
      execute 'update public.profiles set company_id = $1 where id = $2 and company_id is null'
        using v_company_id, p_user_id;
    end if;
  end if;

  return v_org_id;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.provision_user_workspace(
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data, '{}'::jsonb)
  );
  return new;
end;
$$;

-- Run as table owner so trigger inserts bypass RLS (auth.uid() is null during signup)
alter function public.provision_user_workspace(uuid, text, jsonb) owner to postgres;
alter function public.handle_new_user() owner to postgres;

grant execute on function public.provision_user_workspace(uuid, text, jsonb) to service_role;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. RLS — own profile access; org managers can read team profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists profiles_select_org_managers on public.profiles;
create policy profiles_select_org_managers on public.profiles
  for select to authenticated
  using (
    organization_id is not null
    and exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = profiles.organization_id
        and om.active = true
        and om.role in ('owner', 'admin', 'manager')
    )
  );

alter table public.business_profiles enable row level security;

drop policy if exists business_profiles_own on public.business_profiles;
create policy business_profiles_own on public.business_profiles
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Backfill existing auth users (no data wipe)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_org_id uuid;
begin
  for r in
    select u.id, u.email, coalesce(u.raw_user_meta_data, '{}'::jsonb) as metadata
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null
  loop
    v_org_id := public.provision_user_workspace(r.id, r.email, r.metadata);
    raise notice 'Backfilled profile + workspace for user % (org %)', r.id, v_org_id;
  end loop;
end $$;

do $$
declare
  r record;
  v_org_id uuid;
begin
  for r in
    select p.id, p.email, p.organization_id
    from public.profiles p
    where p.organization_id is null
  loop
    v_org_id := public.provision_user_workspace(
      r.id,
      r.email,
      '{}'::jsonb
    );
    raise notice 'Repaired organization_id for profile % (org %)', r.id, v_org_id;
  end loop;
end $$;

do $$
declare
  r record;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'company_id'
  ) then
    raise notice 'profiles.company_id not present — company_id backfill skipped';
    return;
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'companies'
  ) then
    raise notice 'public.companies not present — company_id backfill skipped';
    return;
  end if;

  for r in
    select p.id as user_id
    from public.profiles p
    where p.company_id is null
  loop
    perform public.provision_user_workspace(
      r.user_id,
      (select email from auth.users where id = r.user_id),
      coalesce((select raw_user_meta_data from auth.users where id = r.user_id), '{}'::jsonb)
    );
  end loop;
end $$;

do $$
declare
  r record;
  v_org_id uuid;
begin
  for r in
    select u.id as user_id, p.organization_id, p.email
    from auth.users u
    join public.profiles p on p.id = u.id
    left join public.organization_members om
      on om.user_id = u.id and om.active = true
    where om.id is null
  loop
    v_org_id := coalesce(
      r.organization_id,
      (
        select o.id
        from public.organizations o
        where o.owner_user_id = r.user_id
        order by o.created_at asc nulls last
        limit 1
      )
    );

    if v_org_id is null then
      v_org_id := public.provision_user_workspace(r.user_id, r.email, '{}'::jsonb);
    else
      insert into public.organization_members (organization_id, user_id, role, active)
      values (v_org_id, r.user_id, 'owner', true)
      on conflict (organization_id, user_id) do update set
        role = excluded.role,
        active = true;
    end if;

    raise notice 'Backfilled organization_members for user % (org %)', r.user_id, v_org_id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Verification queries (run after migration)
-- ---------------------------------------------------------------------------
select 'auth.users count' as check_name, count(*)::bigint as value from auth.users;

select 'public.profiles count' as check_name, count(*)::bigint as value from public.profiles;

select 'auth.users without profiles' as check_name, count(*)::bigint as value
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

select u.id, u.email, u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
order by u.created_at desc
limit 25;

select 'profiles without organization_id' as check_name, count(*)::bigint as value
from public.profiles
where organization_id is null;

select id, email, role, organization_id
from public.profiles
where organization_id is null
order by created_at desc nulls last
limit 25;

select 'profiles without company_id (legacy)' as check_name,
  case
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'company_id'
    ) then (
      select count(*)::bigint from public.profiles where company_id is null
    )
    else null
  end as value;

select 'auth.users without organization_members' as check_name, count(*)::bigint as value
from auth.users u
left join public.organization_members om
  on om.user_id = u.id and om.active = true
where om.id is null;

select u.id, u.email
from auth.users u
left join public.organization_members om
  on om.user_id = u.id and om.active = true
where om.id is null
order by u.created_at desc
limit 25;
