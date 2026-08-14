create table if not exists public.calendar_import_ignored_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.calendar_import_connections(id) on delete cascade,
  event_uid text not null,
  ignored_by uuid null references auth.users(id) on delete set null,
  ignored_at timestamptz not null default now(),
  unique (connection_id, event_uid)
);

create index if not exists calendar_import_ignored_events_org_idx
  on public.calendar_import_ignored_events (organization_id, connection_id);

alter table public.calendar_import_ignored_events enable row level security;

comment on table public.calendar_import_ignored_events is
  'Calendar events explicitly ignored during review so they stay hidden on future reviews.';
