-- One-time repair for legacy EverittOS jobs created before wall-clock storage was fixed.
--
-- Background:
-- Older Texas jobs were entered as local clock times, converted to UTC by the browser,
-- and later exported as if the stored UTC clock were already local. For example, a
-- 10:00 AM America/Chicago job could be stored as 15:00Z and exported as 3:00 PM.
--
-- This migration only INSTALLS the guarded repair function. It does not change job
-- rows until an organization ID is explicitly passed to the function.

create table if not exists public.calendar_time_repairs (
  organization_id uuid not null,
  repair_key text not null,
  repaired_at timestamptz not null default now(),
  repaired_rows integer not null default 0,
  primary key (organization_id, repair_key)
);

alter table public.calendar_time_repairs enable row level security;

revoke all on public.calendar_time_repairs from anon, authenticated;

create or replace function public.repair_legacy_texas_job_times(
  target_organization_id uuid,
  legacy_cutoff timestamptz default '2026-07-29 11:00:00+00'::timestamptz
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  organization_timezone text;
  changed_rows integer := 0;
  repair_name constant text := 'legacy-texas-job-wall-clock-v1';
begin
  if target_organization_id is null then
    raise exception 'An organization ID is required.';
  end if;

  select nullif(trim(os.timezone), '')
    into organization_timezone
  from public.organization_settings os
  where os.organization_id = target_organization_id;

  if organization_timezone is null then
    raise exception 'Organization % has no timezone configured.', target_organization_id;
  end if;

  if organization_timezone <> 'America/Chicago' then
    raise exception 'Organization % uses timezone %, not America/Chicago.',
      target_organization_id,
      organization_timezone;
  end if;

  if exists (
    select 1
    from public.calendar_time_repairs r
    where r.organization_id = target_organization_id
      and r.repair_key = repair_name
  ) then
    raise exception 'The legacy Texas calendar repair was already run for organization %.',
      target_organization_id;
  end if;

  -- Convert each legacy UTC instant to its America/Chicago wall-clock value, then
  -- store that same wall-clock value as UTC. This intentionally supports the current
  -- EverittOS wall-clock model while respecting daylight-saving time per job date.
  update public.jobs j
  set
    scheduled_start = case
      when j.scheduled_start is null then null
      else ((j.scheduled_start at time zone 'America/Chicago') at time zone 'UTC')
    end,
    scheduled_end = case
      when j.scheduled_end is null then null
      else ((j.scheduled_end at time zone 'America/Chicago') at time zone 'UTC')
    end,
    updated_at = now()
  where j.organization_id = target_organization_id
    and j.created_at < legacy_cutoff
    and (j.scheduled_start is not null or j.scheduled_end is not null);

  get diagnostics changed_rows = row_count;

  insert into public.calendar_time_repairs (
    organization_id,
    repair_key,
    repaired_rows
  ) values (
    target_organization_id,
    repair_name,
    changed_rows
  );

  return changed_rows;
end;
$$;

revoke all on function public.repair_legacy_texas_job_times(uuid, timestamptz)
  from public, anon, authenticated;

comment on function public.repair_legacy_texas_job_times(uuid, timestamptz) is
  'One-time guarded repair for pre-cutoff America/Chicago jobs whose selected wall-clock times were stored as UTC instants.';

-- HOW TO RUN AFTER APPLYING THIS MIGRATION
--
-- 1. Find the Texas organization ID:
--
-- select organization_id, timezone
-- from public.organization_settings
-- where timezone = 'America/Chicago';
--
-- 2. Preview legacy jobs before changing them:
--
-- select id, title, scheduled_start, scheduled_end, created_at
-- from public.jobs
-- where organization_id = 'PASTE-ORGANIZATION-ID-HERE'::uuid
--   and created_at < '2026-07-29 11:00:00+00'::timestamptz
--   and (scheduled_start is not null or scheduled_end is not null)
-- order by scheduled_start;
--
-- 3. Run the one-time repair:
--
-- select public.repair_legacy_texas_job_times(
--   'PASTE-ORGANIZATION-ID-HERE'::uuid
-- ) as repaired_jobs;
--
-- The function refuses non-America/Chicago organizations and refuses a second run.