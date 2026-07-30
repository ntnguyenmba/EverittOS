-- Hotfix production databases that received the job timezone code before the schema migration.
-- This migration is intentionally idempotent so it is safe to run after earlier timezone migrations.

alter table public.jobs
  add column if not exists timezone text;

comment on column public.jobs.timezone is
  'IANA timezone for the job location, for example America/Chicago. Null means inherit organization_settings.timezone.';

create index if not exists jobs_organization_timezone_idx
  on public.jobs (organization_id, timezone);

-- Ask PostgREST/Supabase to refresh its cached table schema immediately.
notify pgrst, 'reload schema';
