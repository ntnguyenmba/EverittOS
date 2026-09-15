-- Crystal weekend recurring cleanup, preview-first and fail-closed.
-- Intended for manual execution in the Supabase SQL Editor after reviewing PREVIEW 1-3.
-- It never deletes Crystal, customers, completed historical jobs, or Saturday/Sunday jobs.
-- Weekday mapping in EverittOS is 0=Sunday ... 6=Saturday.
-- Cutoff requirement: only dates AFTER 2026-09-16 are eligible.

-- ---------------------------------------------------------------------------
-- PREVIEW 1: verify the worker named Crystal. This must return EXACTLY ONE row.
-- ---------------------------------------------------------------------------
select
  w.id as worker_id,
  w.name as worker_name,
  w.email,
  w.organization_id
from public.workers w
where lower(btrim(coalesce(w.name, ''))) = 'crystal'
order by w.organization_id, w.id;

-- ---------------------------------------------------------------------------
-- PREVIEW 2: verify every future recurring occurrence assigned to Crystal.
-- is_weekend=true rows MUST remain. is_weekend=false rows are eligible only when
-- they are unfinished and after the cutoff.
-- ---------------------------------------------------------------------------
with crystal as (
  select w.id, w.organization_id
  from public.workers w
  where lower(btrim(coalesce(w.name, ''))) = 'crystal'
), crystal_count as (
  select count(*) as n from crystal
)
select
  j.id as job_id,
  j.recurring_series_id,
  j.title,
  coalesce(j.occurrence_date, j.start_date, j.due_date) as scheduled_date,
  trim(to_char(coalesce(j.occurrence_date, j.start_date, j.due_date), 'Day')) as scheduled_day,
  extract(dow from coalesce(j.occurrence_date, j.start_date, j.due_date))::int in (0, 6) as is_weekend,
  j.status,
  j.assigned_to,
  c.id as verified_crystal_worker_id
from public.jobs j
join crystal c
  on c.id = j.assigned_to
 and c.organization_id = j.organization_id
cross join crystal_count cc
where cc.n = 1
  and j.recurring_series_id is not null
  and coalesce(j.occurrence_date, j.start_date, j.due_date) > date '2026-09-16'
order by scheduled_date, j.id;

-- ---------------------------------------------------------------------------
-- PREVIEW 3: series that will remain active for Crystal.
-- For weekly-style series, this cleanup normalizes configured weekdays to
-- Saturday/Sunday only. A series with no weekend day configured is paused,
-- rather than deleted, so customers/history are preserved and bad weekdays
-- cannot regenerate.
-- ---------------------------------------------------------------------------
with crystal as (
  select w.id, w.organization_id
  from public.workers w
  where lower(btrim(coalesce(w.name, ''))) = 'crystal'
), crystal_count as (
  select count(*) as n from crystal
)
select
  s.id as series_id,
  s.title,
  s.status,
  s.recurrence_frequency,
  s.recurrence_interval,
  s.recurrence_interval_unit,
  s.recurrence_weekday,
  s.recurrence_weekdays,
  array(
    select distinct d
    from unnest(
      case
        when cardinality(coalesce(s.recurrence_weekdays, array[]::integer[])) > 0 then s.recurrence_weekdays
        when s.recurrence_weekday is not null then array[s.recurrence_weekday]
        else array[]::integer[]
      end
    ) as d
    where d in (0, 6)
    order by d
  ) as weekend_days_that_will_remain
from public.recurring_job_series s
join crystal c
  on c.id = s.preferred_contractor_id
 and c.organization_id = s.organization_id
cross join crystal_count cc
where cc.n = 1
order by s.title, s.id;

-- ---------------------------------------------------------------------------
-- APPLY: run only after PREVIEW 1 shows exactly one Crystal and PREVIEW 2/3
-- show the expected organization, dates, and days.
-- This block aborts if Crystal is ambiguous or missing.
-- ---------------------------------------------------------------------------
begin;

do $$
declare
  v_crystal_id uuid;
  v_org_id uuid;
  v_crystal_count integer;
  v_deleted_count integer;
  v_updated_series_count integer;
begin
  select count(*) into v_crystal_count
  from public.workers
  where lower(btrim(coalesce(name, ''))) = 'crystal';

  if v_crystal_count <> 1 then
    raise exception 'Safety stop: expected exactly one worker named Crystal, found %.', v_crystal_count;
  end if;

  select id, organization_id
  into v_crystal_id, v_org_id
  from public.workers
  where lower(btrim(coalesce(name, ''))) = 'crystal';

  -- Delete only unfinished recurring weekday occurrences after 2026-09-16.
  -- Saturday (6) and Sunday (0) are explicitly excluded.
  delete from public.jobs j
  where j.organization_id = v_org_id
    and j.assigned_to = v_crystal_id
    and j.recurring_series_id is not null
    and coalesce(j.occurrence_date, j.start_date, j.due_date) > date '2026-09-16'
    and extract(dow from coalesce(j.occurrence_date, j.start_date, j.due_date))::int between 1 and 5
    and lower(coalesce(j.status, '')) not in ('completed', 'done', 'complete', 'closed');
  get diagnostics v_deleted_count = row_count;

  -- Normalize Crystal's weekly-style recurrence definitions to weekends only.
  -- If a series has no weekend day configured, pause it instead of deleting it.
  with target as (
    select
      s.id,
      array(
        select distinct d
        from unnest(
          case
            when cardinality(coalesce(s.recurrence_weekdays, array[]::integer[])) > 0 then s.recurrence_weekdays
            when s.recurrence_weekday is not null then array[s.recurrence_weekday]
            else array[]::integer[]
          end
        ) as d
        where d in (0, 6)
        order by d
      ) as weekend_days
    from public.recurring_job_series s
    where s.organization_id = v_org_id
      and s.preferred_contractor_id = v_crystal_id
      and coalesce(s.recurrence_interval_unit, case when s.recurrence_frequency = 'monthly' then 'months' when s.recurrence_frequency = 'daily' then 'days' else 'weeks' end) = 'weeks'
  )
  update public.recurring_job_series s
  set
    recurrence_weekdays = case when cardinality(t.weekend_days) > 0 then t.weekend_days else s.recurrence_weekdays end,
    recurrence_weekday = case when cardinality(t.weekend_days) = 1 then t.weekend_days[1] else null end,
    status = case when cardinality(t.weekend_days) > 0 then s.status else 'paused' end,
    next_generation_date = case when cardinality(t.weekend_days) > 0 then s.next_generation_date else null end,
    updated_at = now()
  from target t
  where s.id = t.id;
  get diagnostics v_updated_series_count = row_count;

  raise notice 'Crystal worker id: %, organization id: %', v_crystal_id, v_org_id;
  raise notice 'Deleted weekday recurring jobs after 2026-09-16: %', v_deleted_count;
  raise notice 'Reviewed/normalized Crystal weekly recurring series: %', v_updated_series_count;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- VERIFY AFTER APPLY: these first two queries should show zero weekday jobs
-- and only weekend future recurring jobs. The final query shows the remaining
-- Crystal recurrence definitions.
-- ---------------------------------------------------------------------------
with crystal as (
  select w.id, w.organization_id
  from public.workers w
  where lower(btrim(coalesce(w.name, ''))) = 'crystal'
)
select
  j.id,
  j.title,
  coalesce(j.occurrence_date, j.start_date, j.due_date) as scheduled_date,
  trim(to_char(coalesce(j.occurrence_date, j.start_date, j.due_date), 'Day')) as scheduled_day,
  j.status
from public.jobs j
join crystal c on c.id = j.assigned_to and c.organization_id = j.organization_id
where j.recurring_series_id is not null
  and coalesce(j.occurrence_date, j.start_date, j.due_date) > date '2026-09-16'
  and extract(dow from coalesce(j.occurrence_date, j.start_date, j.due_date))::int between 1 and 5
order by scheduled_date;

with crystal as (
  select w.id, w.organization_id
  from public.workers w
  where lower(btrim(coalesce(w.name, ''))) = 'crystal'
)
select
  j.id,
  j.title,
  coalesce(j.occurrence_date, j.start_date, j.due_date) as scheduled_date,
  trim(to_char(coalesce(j.occurrence_date, j.start_date, j.due_date), 'Day')) as scheduled_day,
  j.status
from public.jobs j
join crystal c on c.id = j.assigned_to and c.organization_id = j.organization_id
where j.recurring_series_id is not null
  and coalesce(j.occurrence_date, j.start_date, j.due_date) > date '2026-09-16'
  and extract(dow from coalesce(j.occurrence_date, j.start_date, j.due_date))::int in (0, 6)
order by scheduled_date;

with crystal as (
  select w.id, w.organization_id
  from public.workers w
  where lower(btrim(coalesce(w.name, ''))) = 'crystal'
)
select
  s.id,
  s.title,
  s.status,
  s.recurrence_frequency,
  s.recurrence_interval,
  s.recurrence_interval_unit,
  s.recurrence_weekday,
  s.recurrence_weekdays,
  s.start_date,
  s.end_date,
  s.next_generation_date
from public.recurring_job_series s
join crystal c on c.id = s.preferred_contractor_id and c.organization_id = s.organization_id
order by s.title, s.id;
