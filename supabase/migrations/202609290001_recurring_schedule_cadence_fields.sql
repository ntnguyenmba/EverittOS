-- Recurring schedule cadence fields.
-- Safe, idempotent. Preserves existing series and generated jobs.
-- Adds interval unit, multi-weekday support, and expanded frequencies.

-- ---------------------------------------------------------------------------
-- 1) New columns
-- ---------------------------------------------------------------------------
alter table public.recurring_job_series
  add column if not exists recurrence_interval_unit text,
  add column if not exists recurrence_weekdays integer[];

-- ---------------------------------------------------------------------------
-- 2) Backfill interval unit from known frequencies
-- ---------------------------------------------------------------------------
update public.recurring_job_series
set recurrence_interval_unit = case
  when recurrence_frequency = 'monthly' then 'months'
  when recurrence_frequency = 'daily' then 'days'
  when recurrence_frequency = 'custom' and coalesce(recurrence_interval_unit, '') = 'months' then 'months'
  else 'weeks'
end
where recurrence_interval_unit is null;

update public.recurring_job_series
set recurrence_weekdays = array[recurrence_weekday]
where recurrence_weekdays is null
  and recurrence_weekday is not null;

-- ---------------------------------------------------------------------------
-- 3) Expand frequency + interval checks
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'recurring_job_series_frequency_check'
      and conrelid = 'public.recurring_job_series'::regclass
  ) then
    alter table public.recurring_job_series drop constraint recurring_job_series_frequency_check;
  end if;
end $$;

alter table public.recurring_job_series
  add constraint recurring_job_series_frequency_check
  check (
    recurrence_frequency in (
      'none',
      'daily',
      'weekly',
      'biweekly',
      'every_three_weeks',
      'every_four_weeks',
      'monthly',
      'custom'
    )
  );

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'recurring_job_series_interval_check'
      and conrelid = 'public.recurring_job_series'::regclass
  ) then
    alter table public.recurring_job_series drop constraint recurring_job_series_interval_check;
  end if;
end $$;

alter table public.recurring_job_series
  add constraint recurring_job_series_interval_check
  check (recurrence_interval >= 1 and recurrence_interval <= 365);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'recurring_job_series_interval_unit_check'
      and conrelid = 'public.recurring_job_series'::regclass
  ) then
    alter table public.recurring_job_series
      add constraint recurring_job_series_interval_unit_check
      check (
        recurrence_interval_unit is null
        or recurrence_interval_unit in ('days', 'weeks', 'months')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'recurring_job_series_weekdays_check'
      and conrelid = 'public.recurring_job_series'::regclass
  ) then
    alter table public.recurring_job_series
      add constraint recurring_job_series_weekdays_check
      check (
        recurrence_weekdays is null
        or (
          cardinality(recurrence_weekdays) >= 1
          and cardinality(recurrence_weekdays) <= 7
          and recurrence_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]
        )
      );
  end if;
end $$;

comment on column public.recurring_job_series.recurrence_interval_unit is
  'Cadence unit for custom/daily schedules: days, weeks, or months.';
comment on column public.recurring_job_series.recurrence_weekdays is
  'Selected weekdays (0=Sun..6=Sat). Used for weekly-style schedules.';
comment on column public.recurring_job_series.occurrence_limit is
  'Max successfully generated jobs for the series (includes skipped/cancelled).';
