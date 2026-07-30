-- Add a validated IANA timezone to every job while preserving the workspace default.

alter table public.jobs
  add column if not exists timezone text;

comment on column public.jobs.timezone is
  'IANA timezone for the job location, for example America/Chicago. Null means inherit organization_settings.timezone.';

create index if not exists jobs_organization_timezone_idx
  on public.jobs (organization_id, timezone);

create or replace function public.is_valid_timezone_name(value text)
returns boolean
language sql
stable
as $$
  select value is not null
    and btrim(value) <> ''
    and exists (
      select 1
      from pg_timezone_names
      where name = btrim(value)
    );
$$;

alter table public.jobs
  drop constraint if exists jobs_timezone_valid_check;

alter table public.jobs
  add constraint jobs_timezone_valid_check
  check (timezone is null or public.is_valid_timezone_name(timezone));

alter table public.organization_settings
  drop constraint if exists organization_settings_timezone_valid_check;

alter table public.organization_settings
  add constraint organization_settings_timezone_valid_check
  check (timezone is null or public.is_valid_timezone_name(timezone));

-- Existing jobs keep their current wall-clock meaning by inheriting the workspace timezone.
-- Only explicit job overrides are stored in jobs.timezone.

create or replace function public.effective_job_timezone(job_row public.jobs)
returns text
language sql
stable
security invoker
as $$
  select coalesce(
    nullif(btrim(job_row.timezone), ''),
    (
      select nullif(btrim(settings.timezone), '')
      from public.organization_settings settings
      where settings.organization_id = job_row.organization_id
      limit 1
    ),
    'America/Chicago'
  );
$$;
