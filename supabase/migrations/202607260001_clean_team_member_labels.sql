-- Keep assignment dropdown labels readable by ensuring every active team member
-- has a usable profile email and by removing duplicate email-as-name values.
-- Safe to re-run. Does not delete users or memberships.

-- Create missing profiles for active organization members from auth.users.
insert into public.profiles (
  id,
  email,
  full_name,
  role,
  plan,
  subscription_status,
  account_status,
  business_name,
  organization_id
)
select
  om.user_id,
  u.email,
  nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')), ''),
  case
    when om.role in ('owner', 'admin', 'manager', 'employee', 'contractor', 'client', 'viewer', 'crew_lead', 'staff')
      then om.role
    else 'employee'
  end,
  'free',
  'free',
  'active',
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'business_name'), ''),
    nullif(trim(split_part(coalesce(u.email, ''), '@', 1)), ''),
    'Team member'
  ),
  om.organization_id
from public.organization_members om
join auth.users u on u.id = om.user_id
left join public.profiles p on p.id = om.user_id
where om.active = true
  and p.id is null
on conflict (id) do nothing;

-- Fill missing profile emails from the authenticated user record.
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and nullif(trim(coalesce(p.email, '')), '') is null
  and nullif(trim(coalesce(u.email, '')), '') is not null;

-- Keep organization and role aligned with an active membership where missing.
update public.profiles p
set organization_id = om.organization_id,
    role = case
      when om.role in ('owner', 'admin', 'manager', 'employee', 'contractor', 'client', 'viewer', 'crew_lead', 'staff')
        then om.role
      else coalesce(nullif(trim(p.role), ''), 'employee')
    end
from public.organization_members om
where p.id = om.user_id
  and om.active = true
  and (
    p.organization_id is null
    or nullif(trim(coalesce(p.role, '')), '') is null
  );

-- Some invited accounts stored their email address as both full_name and email,
-- which produced labels such as "email (email)". Treat that as no display name.
update public.profiles
set full_name = null
where nullif(trim(coalesce(email, '')), '') is not null
  and lower(trim(coalesce(full_name, ''))) = lower(trim(email));

-- Also clear UUID-shaped placeholder names so the UI falls back to email.
update public.profiles
set full_name = null
where trim(coalesce(full_name, '')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
