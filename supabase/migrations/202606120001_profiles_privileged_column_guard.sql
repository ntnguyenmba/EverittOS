-- Prevent authenticated users from self-updating billing, role, or account-control columns on profiles.
-- Service role (admin client, webhooks) bypasses this guard.

create or replace function public.guard_profiles_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if jwt_role = 'service_role' then
    return new;
  end if;

  if auth.uid() is null or auth.uid() <> old.id then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'profiles.role cannot be changed by the profile owner';
  end if;

  if new.plan is distinct from old.plan then
    raise exception 'profiles.plan cannot be changed by the profile owner';
  end if;

  if new.subscription_status is distinct from old.subscription_status then
    raise exception 'profiles.subscription_status cannot be changed by the profile owner';
  end if;

  if new.account_status is distinct from old.account_status then
    raise exception 'profiles.account_status cannot be changed by the profile owner';
  end if;

  if new.stripe_customer_id is distinct from old.stripe_customer_id then
    raise exception 'profiles.stripe_customer_id cannot be changed by the profile owner';
  end if;

  if new.organization_id is distinct from old.organization_id then
    raise exception 'profiles.organization_id cannot be changed by the profile owner';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged_columns on public.profiles;
create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row
  execute function public.guard_profiles_privileged_columns();

comment on function public.guard_profiles_privileged_columns() is
  'Blocks self-service updates to role, billing, and account-control columns on profiles.';
