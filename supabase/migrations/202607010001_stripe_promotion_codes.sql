-- Store applied Stripe promotion codes and coupon metadata on billing records.

alter table public.profiles
  add column if not exists stripe_promotion_code text,
  add column if not exists stripe_coupon_id text,
  add column if not exists coupon_name text,
  add column if not exists coupon_percent_off numeric(5, 2),
  add column if not exists coupon_amount_off integer,
  add column if not exists coupon_duration text,
  add column if not exists coupon_duration_in_months integer,
  add column if not exists coupon_expires_at timestamptz;

alter table public.everittos_subscriptions
  add column if not exists stripe_promotion_code text,
  add column if not exists stripe_coupon_id text,
  add column if not exists coupon_name text,
  add column if not exists coupon_percent_off numeric(5, 2),
  add column if not exists coupon_amount_off integer,
  add column if not exists coupon_duration text,
  add column if not exists coupon_duration_in_months integer,
  add column if not exists coupon_expires_at timestamptz;

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

  if new.stripe_promotion_code is distinct from old.stripe_promotion_code
    or new.stripe_coupon_id is distinct from old.stripe_coupon_id
    or new.coupon_name is distinct from old.coupon_name
    or new.coupon_percent_off is distinct from old.coupon_percent_off
    or new.coupon_amount_off is distinct from old.coupon_amount_off
    or new.coupon_duration is distinct from old.coupon_duration
    or new.coupon_duration_in_months is distinct from old.coupon_duration_in_months
    or new.coupon_expires_at is distinct from old.coupon_expires_at then
    raise exception 'profiles coupon fields cannot be changed by the profile owner';
  end if;

  return new;
end;
$$;
