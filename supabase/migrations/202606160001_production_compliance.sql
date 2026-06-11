-- Production compliance: consent timestamps, privacy preferences, soft delete, locale.

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists terms_version text,
  add column if not exists privacy_version text,
  add column if not exists marketing_emails boolean not null default false,
  add column if not exists product_updates boolean not null default true,
  add column if not exists operational_notifications boolean not null default true,
  add column if not exists email_notifications boolean not null default true,
  add column if not exists push_notifications boolean not null default false,
  add column if not exists sms_notifications boolean not null default false,
  add column if not exists do_not_sell boolean not null default false,
  add column if not exists preferred_locale text default 'en',
  add column if not exists deleted_at timestamptz,
  add column if not exists deletion_scheduled_at timestamptz;

create index if not exists profiles_deleted_at_idx on public.profiles (deleted_at) where deleted_at is not null;
