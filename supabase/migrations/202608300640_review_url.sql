alter table if exists public.organization_settings
  add column if not exists review_url text;
