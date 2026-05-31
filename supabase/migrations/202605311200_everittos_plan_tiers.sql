-- EverittOS plan values for profiles and subscriptions (free, pro, business)

alter table if exists public.profiles
  drop constraint if exists profiles_plan_check;

alter table if exists public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'pro', 'business'));

alter table if exists public.everittos_subscriptions
  drop constraint if exists everittos_subscriptions_plan_check;

alter table if exists public.everittos_subscriptions
  add constraint everittos_subscriptions_plan_check
  check (plan in ('pro', 'business'));
