-- Visit-based scheduling for jobs with different hours across multiple days.

create table if not exists public.job_visits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  visit_date date not null,
  start_time time not null,
  end_time time not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_visits_valid_time check (end_time > start_time)
);

create index if not exists job_visits_job_idx
  on public.job_visits (job_id, visit_date, start_time);

create index if not exists job_visits_org_date_idx
  on public.job_visits (organization_id, visit_date);

alter table public.job_visits enable row level security;

drop policy if exists job_visits_select on public.job_visits;
create policy job_visits_select on public.job_visits
  for select using (public.is_org_member(organization_id));

drop policy if exists job_visits_insert on public.job_visits;
create policy job_visits_insert on public.job_visits
  for insert with check (public.is_org_manager(organization_id));

drop policy if exists job_visits_update on public.job_visits;
create policy job_visits_update on public.job_visits
  for update using (public.is_org_manager(organization_id)) with check (public.is_org_manager(organization_id));

drop policy if exists job_visits_delete on public.job_visits;
create policy job_visits_delete on public.job_visits
  for delete using (public.is_org_manager(organization_id));

-- Seed one visit for existing scheduled jobs so older records still display in the new Visits UI.
insert into public.job_visits (organization_id, job_id, visit_date, start_time, end_time)
select
  j.organization_id,
  j.id,
  coalesce(j.scheduled_start::date, j.start_date, j.due_date),
  coalesce(j.scheduled_start::time, time '08:00'),
  case
    when coalesce(j.scheduled_end::time, time '16:00') > coalesce(j.scheduled_start::time, time '08:00')
      then coalesce(j.scheduled_end::time, time '16:00')
    else coalesce(j.scheduled_start::time, time '08:00') + interval '1 hour'
  end
from public.jobs j
where j.organization_id is not null
  and coalesce(j.scheduled_start::date, j.start_date, j.due_date) is not null
  and not exists (select 1 from public.job_visits v where v.job_id = j.id);

-- Allow one Google event per visit while keeping existing job-level event rows valid.
alter table public.job_google_calendar_events
  add column if not exists visit_id uuid references public.job_visits(id) on delete cascade;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'job_google_calendar_events_job_id_key'
      and conrelid = 'public.job_google_calendar_events'::regclass
  ) then
    alter table public.job_google_calendar_events drop constraint job_google_calendar_events_job_id_key;
  end if;
end $$;

create unique index if not exists job_google_calendar_events_job_only_uidx
  on public.job_google_calendar_events (job_id)
  where visit_id is null;

create unique index if not exists job_google_calendar_events_visit_uidx
  on public.job_google_calendar_events (visit_id)
  where visit_id is not null;
