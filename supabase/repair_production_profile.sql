-- Repair production profile/workspace bootstrap for an existing auth user.
-- Run in Supabase Dashboard → SQL Editor.
--
-- 1. Adds missing billing columns when an older profiles table is in production.
-- 2. Creates or repairs profile, organization, and active organization membership.
--
-- Default user from production incident (change v_user_id if needed):
-- 271db5bf-ac35-4478-b3f4-94f5740563c5

alter table public.profiles
  add column if not exists plan text default 'free';

alter table public.profiles
  add column if not exists subscription_status text default 'free';

alter table public.profiles
  add column if not exists account_status text not null default 'active';

alter table public.profiles
  add column if not exists organization_id uuid;

alter table public.profiles
  add column if not exists role text default 'owner';

alter table public.profiles
  add column if not exists business_name text;

alter table public.profiles
  add column if not exists email text;

do $$
declare
  v_user_id uuid := '271db5bf-ac35-4478-b3f4-94f5740563c5';
  v_email text;
  v_role text := 'owner';
  v_org_id uuid;
  v_business_name text;
begin
  select lower(trim(email)) into v_email
  from auth.users
  where id = v_user_id;

  if v_email is null then
    raise exception 'No auth.users row for %', v_user_id;
  end if;

  v_business_name := coalesce(
    (select nullif(trim(business_name), '') from public.profiles where id = v_user_id),
    split_part(v_email, '@', 1),
    'My Business'
  );

  insert into public.profiles (
    id,
    email,
    role,
    plan,
    subscription_status,
    account_status,
    business_name
  )
  values (
    v_user_id,
    v_email,
    v_role,
    'free',
    'free',
    'active',
    v_business_name
  )
  on conflict (id) do update set
    email = excluded.email,
    role = coalesce(nullif(trim(public.profiles.role), ''), excluded.role),
    plan = coalesce(public.profiles.plan, excluded.plan, 'free'),
    subscription_status = coalesce(public.profiles.subscription_status, excluded.subscription_status, 'free'),
    account_status = 'active',
    business_name = coalesce(nullif(trim(public.profiles.business_name), ''), excluded.business_name);

  select organization_id into v_org_id
  from public.profiles
  where id = v_user_id;

  if v_org_id is null then
    select om.organization_id into v_org_id
    from public.organization_members om
    where om.user_id = v_user_id and om.active = true
    order by om.created_at asc nulls last
    limit 1;
  end if;

  if v_org_id is null then
    insert into public.organizations (name, owner_user_id)
    values (v_business_name, v_user_id)
    returning id into v_org_id;
  else
    update public.organizations
    set owner_user_id = v_user_id
    where id = v_org_id;
  end if;

  insert into public.organization_members (organization_id, user_id, role, active)
  values (v_org_id, v_user_id, v_role, true)
  on conflict (organization_id, user_id) do update set
    role = excluded.role,
    active = true;

  update public.profiles
  set organization_id = v_org_id,
      role = v_role
  where id = v_user_id;

  insert into public.organization_settings (organization_id)
  values (v_org_id)
  on conflict (organization_id) do nothing;

  insert into public.business_profiles (user_id, business_name, email)
  values (v_user_id, v_business_name, v_email)
  on conflict (user_id) do update set
    business_name = excluded.business_name,
    email = excluded.email;

  raise notice 'Repaired user %, organization %', v_user_id, v_org_id;
end $$;

-- Verify:
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
