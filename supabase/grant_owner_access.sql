-- Grant owner (or admin) access for an existing Supabase Auth user.
-- Run in Supabase Dashboard → SQL Editor.
--
-- 1. Replace YOUR_EMAIL@DOMAIN.COM below with your sign-in email (lowercase recommended).
-- 2. Run the entire script once.
-- 3. Sign out of EverittOS and sign in again.
--
-- For admin instead of owner: change v_role to 'admin' (keeps org owner_user_id unchanged).

do $$
declare
  v_email text := lower(trim('YOUR_EMAIL@DOMAIN.COM')); -- <<< CHANGE THIS
  v_role text := 'owner'; -- or 'admin'
  v_user_id uuid;
  v_org_id uuid;
  v_business_name text;
begin
  if v_email = 'your_email@domain.com' then
    raise exception 'Replace YOUR_EMAIL@DOMAIN.COM with your real sign-in email before running.';
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = v_email;

  if v_user_id is null then
    raise exception 'No auth.users row for %. Create the account in EverittOS signup or Supabase Auth first.', v_email;
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
    coalesce((select plan from public.profiles where id = v_user_id), 'free'),
    coalesce((select subscription_status from public.profiles where id = v_user_id), 'free'),
    'active',
    v_business_name
  )
  on conflict (id) do update set
    email = excluded.email,
    role = v_role,
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
  elsif v_role = 'owner' then
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

  raise notice 'Done. User % (id %) is % of organization %', v_email, v_user_id, v_role, v_org_id;
end $$;

-- Verify (optional):
-- select p.id, p.email, p.role, p.organization_id, om.role as member_role, om.active
-- from public.profiles p
-- left join public.organization_members om on om.user_id = p.id and om.organization_id = p.organization_id
-- where lower(p.email) = lower('YOUR_EMAIL@DOMAIN.COM');
