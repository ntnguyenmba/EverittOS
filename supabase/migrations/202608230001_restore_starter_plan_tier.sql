-- Restore Starter as a first-class paid tier aligned with lib/plan-config.ts and lib/billing-config.ts

insert into public.plan_tier_limits (
  plan_id,
  jobs_cap,
  photos_cap,
  customers_cap,
  reports_cap,
  team_members_cap,
  crew_members_cap,
  locations_cap,
  crew_assignment,
  team_management,
  scheduling,
  activity_log,
  advanced_reporting,
  workflow_customization,
  multi_location,
  custom_branding,
  pdf_reports,
  bookings,
  ai_access,
  ai_unlimited
) values (
  'starter',
  500,
  -1,
  5000,
  -1,
  50,
  200,
  5,
  true,
  true,
  true,
  true,
  true,
  false,
  true,
  true,
  true,
  true,
  true,
  false
)
on conflict (plan_id) do update set
  jobs_cap = excluded.jobs_cap,
  photos_cap = excluded.photos_cap,
  customers_cap = excluded.customers_cap,
  reports_cap = excluded.reports_cap,
  team_members_cap = excluded.team_members_cap,
  crew_members_cap = excluded.crew_members_cap,
  locations_cap = excluded.locations_cap,
  crew_assignment = excluded.crew_assignment,
  team_management = excluded.team_management,
  scheduling = excluded.scheduling,
  activity_log = excluded.activity_log,
  advanced_reporting = excluded.advanced_reporting,
  workflow_customization = excluded.workflow_customization,
  multi_location = excluded.multi_location,
  custom_branding = excluded.custom_branding,
  pdf_reports = excluded.pdf_reports,
  bookings = excluded.bookings,
  ai_access = excluded.ai_access,
  ai_unlimited = excluded.ai_unlimited;

alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'pro', 'business', 'starter', 'growth', 'enterprise'));

alter table public.everittos_subscriptions drop constraint if exists everittos_subscriptions_plan_check;
alter table public.everittos_subscriptions
  add constraint everittos_subscriptions_plan_check
  check (plan in ('pro', 'business', 'starter', 'growth', 'enterprise'));
