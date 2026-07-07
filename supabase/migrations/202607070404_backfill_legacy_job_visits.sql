-- Backfill visit rows for legacy jobs that only had start_date/due_date or scheduled_start/scheduled_end.
-- This protects older multi-day jobs so they show on every scheduled day.

insert into public.job_visits (
  organization_id,
  job_id,
  visit_date,
  start_time,
  end_time,
  notes
)
select
  j.organization_id,
  j.id,
  day::date,
  coalesce(to_char(j.scheduled_start::time, 'HH24:MI'), '09:00')::time,
  coalesce(to_char(j.scheduled_end::time, 'HH24:MI'), '17:00')::time,
  null
from public.jobs j
cross join lateral generate_series(
  coalesce(j.start_date, j.scheduled_start::date, j.due_date)::date,
  coalesce(j.due_date, j.scheduled_end::date, j.start_date, j.scheduled_start::date)::date,
  interval '1 day'
) as day
where j.organization_id is not null
  and coalesce(j.start_date, j.scheduled_start::date, j.due_date) is not null
  and coalesce(j.due_date, j.scheduled_end::date, j.start_date, j.scheduled_start::date) is not null
  and coalesce(j.due_date, j.scheduled_end::date, j.start_date, j.scheduled_start::date)::date
    >= coalesce(j.start_date, j.scheduled_start::date, j.due_date)::date
  and coalesce(j.due_date, j.scheduled_end::date, j.start_date, j.scheduled_start::date)::date
    <= coalesce(j.start_date, j.scheduled_start::date, j.due_date)::date + interval '31 days'
  and not exists (
    select 1
    from public.job_visits existing
    where existing.job_id = j.id
  )
  and not exists (
    select 1
    from public.job_visits duplicate
    where duplicate.job_id = j.id
      and duplicate.visit_date = day::date
  );

notify pgrst, 'reload schema';
