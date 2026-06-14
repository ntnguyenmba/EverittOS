-- Bookings feature gate: Pro ($9/month) and all higher paid plans

alter table public.plan_tier_limits
  add column if not exists bookings boolean not null default false;

update public.plan_tier_limits
set bookings = (plan_id <> 'free')
where plan_id in ('free', 'pro', 'business', 'operations', 'growth', 'enterprise');
