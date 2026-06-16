-- Remove deprecated Operations plan tier. Migrate legacy rows to Growth / Pro.

update public.profiles
set plan = 'growth'
where plan = 'operations';

update public.profiles
set plan = 'pro'
where lower(plan) = 'starter';

update public.profiles
set subscription_status = 'everittos_growth'
where subscription_status = 'everittos_operations';

update public.everittos_subscriptions
set plan = 'growth'
where plan = 'operations';

update public.everittos_subscriptions
set plan = 'pro'
where lower(plan) = 'starter';

delete from public.plan_tier_limits where plan_id = 'operations';
delete from public.plan_tier_limits where plan_id = 'starter';

alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'pro', 'business', 'growth', 'enterprise'));

alter table public.everittos_subscriptions drop constraint if exists everittos_subscriptions_plan_check;
alter table public.everittos_subscriptions
  add constraint everittos_subscriptions_plan_check
  check (plan in ('pro', 'business', 'growth', 'enterprise'));
