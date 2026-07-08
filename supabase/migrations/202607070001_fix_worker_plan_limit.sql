-- Fix false PLAN_LIMIT_CREW errors when assigning an existing team member to a job.
-- The app already checks team access before inserting a compatibility worker row.
-- This trigger should not block job assignment just because the user's legacy profile plan is not Business.

create or replace function public.enforce_worker_insert_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_plan text;
  member_count int;
begin
  select lower(coalesce(plan, 'free'))
    into org_plan
  from public.organizations
  where id = new.organization_id;

  if org_plan in ('business', 'growth', 'enterprise') then
    return new;
  end if;

  select count(*)::int
    into member_count
  from public.organization_members
  where organization_id = new.organization_id
    and active = true;

  if member_count <= 1 then
    return new;
  end if;

  raise exception 'PLAN_LIMIT_CREW';
end;
$$;
