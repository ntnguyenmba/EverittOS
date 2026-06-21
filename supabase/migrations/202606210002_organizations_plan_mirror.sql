-- Mirror paid plan on organizations for billing diagnostics and admin reporting.
alter table public.organizations
  add column if not exists plan text default 'free';

alter table public.organizations drop constraint if exists organizations_plan_check;
alter table public.organizations
  add constraint organizations_plan_check
  check (plan in ('free', 'pro', 'business', 'starter', 'growth', 'enterprise'));

update public.organizations o
set plan = coalesce(p.plan, 'free')
from public.profiles p
where p.id = o.owner_user_id
  and (o.plan is null or o.plan = 'free')
  and coalesce(p.plan, 'free') <> 'free';

comment on column public.organizations.plan is 'Denormalized paid plan mirror of the organization owner profiles.plan';
