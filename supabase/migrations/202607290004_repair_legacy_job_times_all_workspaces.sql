-- One-time global repair for legacy EverittOS jobs created before wall-clock
-- storage was corrected. Each workspace is repaired using its configured IANA
-- timezone, then recorded so the same workspace cannot be shifted twice.

create table if not exists public.calendar_time_repairs (
  organization_id uuid not null,
  repair_key text not null,
  repaired_at timestamptz not null default now(),
  repaired_rows integer not null default 0,
  primary key (organization_id, repair_key)
);

alter table public.calendar_time_repairs enable row level security;
revoke all on public.calendar_time_repairs from anon, authenticated;

create or replace function public.repair_legacy_job_times_all_workspaces(
  legacy_cutoff timestamptz default '2026-07-29 11:00:00+00'::timestamptz
)
returns table (
  repaired_organizations integer,
  repaired_jobs integer,
  skipped_organizations integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace record;
  changed_rows integer;
  organizations_changed integer := 0;
  jobs_changed integer := 0;
  organizations_skipped integer := 0;
  repair_name constant text := 'legacy-job-wall-clock-all-workspaces-v1';
begin
  for workspace in
    select
      os.organization_id,
      nullif(trim(os.timezone), '') as timezone
    from public.organization_settings os
    where nullif(trim(os.timezone), '') is not null
  loop
    -- Do not process a workspace twice. Also honor the earlier Texas-only
    -- repair marker so an already repaired workspace is never shifted again.
    if exists (
      select 1
      from public.calendar_time_repairs r
      where r.organization_id = workspace.organization_id
        and r.repair_key in (
          repair_name,
          'legacy-texas-job-wall-clock-v1'
        )
    ) then
      organizations_skipped := organizations_skipped + 1;
      continue;
    end if;

    -- Skip invalid timezone values instead of failing the complete migration.
    if not exists (
      select 1
      from pg_timezone_names tz
      where tz.name = workspace.timezone
    ) then
      insert into public.calendar_time_repairs (
        organization_id,
        repair_key,
        repaired_rows
      ) values (
        workspace.organization_id,
        repair_name,
        0
      ) on conflict do nothing;

      organizations_skipped := organizations_skipped + 1;
      continue;
    end if;

    -- Legacy rows contain the correct local clock displayed as a UTC instant.
    -- Convert that instant to the workspace's local wall-clock value and store
    -- the same wall-clock value in EverittOS's UTC-backed wall-clock model.
    update public.jobs j
    set
      scheduled_start = case
        when j.scheduled_start is null then null
        else ((j.scheduled_start at time zone workspace.timezone) at time zone 'UTC')
      end,
      scheduled_end = case
        when j.scheduled_end is null then null
        else ((j.scheduled_end at time zone workspace.timezone) at time zone 'UTC')
      end,
      updated_at = now()
    where j.organization_id = workspace.organization_id
      and j.created_at < legacy_cutoff
      and (j.scheduled_start is not null or j.scheduled_end is not null);

    get diagnostics changed_rows = row_count;

    insert into public.calendar_time_repairs (
      organization_id,
      repair_key,
      repaired_rows
    ) values (
      workspace.organization_id,
      repair_name,
      changed_rows
    );

    organizations_changed := organizations_changed + 1;
    jobs_changed := jobs_changed + changed_rows;
  end loop;

  return query
  select organizations_changed, jobs_changed, organizations_skipped;
end;
$$;

revoke all on function public.repair_legacy_job_times_all_workspaces(timestamptz)
  from public, anon, authenticated;

grant execute on function public.repair_legacy_job_times_all_workspaces(timestamptz)
  to service_role;

comment on function public.repair_legacy_job_times_all_workspaces(timestamptz) is
  'One-time guarded repair for all pre-cutoff jobs using each workspace configured IANA timezone.';

-- Run automatically when this migration is applied so every existing workspace
-- is corrected without requiring an organization ID or manual per-user action.
select * from public.repair_legacy_job_times_all_workspaces();
