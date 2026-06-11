-- Google Calendar OAuth connections (tokens accessed via service role only).

create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connected_by_user_id uuid references public.profiles(id) on delete set null,
  google_email text,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  calendar_id text not null default 'primary',
  sync_enabled boolean not null default true,
  last_sync_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create index if not exists google_calendar_connections_org_idx
  on public.google_calendar_connections (organization_id);

create table if not exists public.job_google_calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  google_event_id text not null,
  calendar_id text not null default 'primary',
  last_synced_at timestamptz not null default now(),
  unique (job_id)
);

create index if not exists job_google_calendar_events_job_idx
  on public.job_google_calendar_events (job_id);

create index if not exists job_google_calendar_events_org_idx
  on public.job_google_calendar_events (organization_id);

alter table public.google_calendar_connections enable row level security;
alter table public.job_google_calendar_events enable row level security;

-- Tokens must never be readable from the browser client.
drop policy if exists google_calendar_connections_deny on public.google_calendar_connections;
create policy google_calendar_connections_deny on public.google_calendar_connections
  for all using (false);

drop policy if exists job_google_calendar_events_select on public.job_google_calendar_events;
create policy job_google_calendar_events_select on public.job_google_calendar_events
  for select using (public.is_org_member(organization_id));

drop policy if exists job_google_calendar_events_write on public.job_google_calendar_events;
create policy job_google_calendar_events_write on public.job_google_calendar_events
  for all using (false);
