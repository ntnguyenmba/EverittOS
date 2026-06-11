-- Add billing columns missing from older production profiles tables.
-- Safe to run multiple times.

alter table public.profiles
  add column if not exists plan text default 'free';

alter table public.profiles
  add column if not exists subscription_status text default 'free';

update public.profiles
set plan = 'free'
where plan is null;

update public.profiles
set subscription_status = coalesce(subscription_status, 'free')
where subscription_status is null;

alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check
  check (plan in ('free', 'pro', 'business', 'operations', 'growth', 'enterprise'));

comment on column public.profiles.plan is 'EverittOS billing plan for the user/workspace owner';
comment on column public.profiles.subscription_status is 'Stripe/subscription lifecycle status mirrored from billing';
