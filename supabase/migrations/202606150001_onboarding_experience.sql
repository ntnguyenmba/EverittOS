-- Optional onboarding experience: skip flag, operations focus, existing workspace backfill.

alter table public.organization_settings
  add column if not exists onboarding_skipped boolean not null default false,
  add column if not exists operations_focus text[] not null default '{}';

-- Existing workspaces should not be forced through onboarding on deploy.
update public.organization_settings
set onboarding_completed = true
where onboarding_completed = false;
