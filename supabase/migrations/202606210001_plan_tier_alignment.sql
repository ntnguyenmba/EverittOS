-- Align plan_tier_limits with lib/plan-config.ts (central plan source of truth)

insert into public.plan_tier_limits (
  plan_id, jobs_cap, photos_cap, customers_cap, reports_cap, team_members_cap, crew_members_cap, locations_cap,
  crew_assignment, team_management, scheduling, activity_log, advanced_reporting, workflow_customization,
  multi_location, custom_branding, pdf_reports
) values
  ('free', 3, 20, 10, 0, 1, 0, 1, false, false, true, false, false, false, false, false, false),
  ('pro', 25, 100, 100, -1, 3, 0, 1, false, false, true, false, false, false, false, false, true),
  ('business', 150, -1, 1000, -1, 15, 100, 1, true, true, true, true, true, false, false, false, true),
  ('operations', 500, -1, 5000, -1, 50, 200, 5, true, true, true, true, true, true, false, true, true),
  ('growth', 2500, -1, 25000, -1, 250, -1, 25, true, true, true, true, true, true, true, true, true),
  ('enterprise', -1, -1, -1, -1, -1, -1, -1, true, true, true, true, true, true, true, true, true)
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
  pdf_reports = excluded.pdf_reports;

-- Free tier allows limited photo uploads (not zero)
create or replace function public.enforce_photo_insert_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  oid uuid;
  p text;
  photo_cap int;
begin
  oid := coalesce(new.organization_id, (select organization_id from public.profiles where id = new.user_id));
  p := public.plan_for_organization(oid);
  photo_cap := public.plan_limit_cap(p, 'photos');
  if photo_cap = 0 then
    raise exception 'PLAN_REQUIRES_PRO_PHOTOS';
  end if;
  if photo_cap < 0 then
    return new;
  end if;
  perform public.enforce_org_resource_limit(oid, 'photos', 'job_photos');
  return new;
end;
$$;
