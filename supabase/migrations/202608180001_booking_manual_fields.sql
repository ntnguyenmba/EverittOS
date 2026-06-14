-- Manual booking fields, notification timestamps, and optional service_id.

alter table public.bookings
  add column if not exists manual_service_name text,
  add column if not exists staff_name text,
  add column if not exists confirmation_sent_at timestamptz,
  add column if not exists staff_notified_at timestamptz,
  add column if not exists calendar_sync_error text;

alter table public.bookings alter column service_id drop not null;

alter table public.bookings drop constraint if exists bookings_service_or_manual_check;
alter table public.bookings add constraint bookings_service_or_manual_check
  check (service_id is not null or nullif(trim(manual_service_name), '') is not null);

comment on column public.bookings.manual_service_name is 'Free-text appointment name for manual bookings without a saved service';
comment on column public.bookings.staff_name is 'Free-text staff name when no worker_id is assigned';
comment on column public.bookings.confirmation_sent_at is 'When customer confirmation email was last sent';
comment on column public.bookings.staff_notified_at is 'When staff notification email was last sent';
comment on column public.bookings.calendar_sync_error is 'Last Google Calendar sync error, if any';
