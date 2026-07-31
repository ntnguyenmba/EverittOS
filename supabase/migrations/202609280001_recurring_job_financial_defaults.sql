-- Recurring job financial defaults + per-occurrence expected finance fields.
-- Uses numeric(12,2) dollars to match existing jobs/expenses/job_labor money columns.
-- Idempotent. Does not rewrite historical financial values.

-- ---------------------------------------------------------------------------
-- 1) Series defaults for finance (copied onto each generated occurrence)
-- ---------------------------------------------------------------------------
alter table public.recurring_job_series
  add column if not exists default_contractor_cost numeric(12, 2),
  add column if not exists default_additional_expense numeric(12, 2),
  add column if not exists default_expense_description text,
  add column if not exists default_contractor_pay_basis text,
  add column if not exists default_contractor_hours numeric(10, 2),
  add column if not exists default_contractor_hourly_rate numeric(12, 2),
  add column if not exists default_contractor_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'recurring_job_series_contractor_pay_basis_check'
      and conrelid = 'public.recurring_job_series'::regclass
  ) then
    alter table public.recurring_job_series
      add constraint recurring_job_series_contractor_pay_basis_check
      check (
        default_contractor_pay_basis is null
        or lower(default_contractor_pay_basis) in ('hourly', 'flat', 'visit')
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Per-occurrence expected finance (editable independently of the series)
-- ---------------------------------------------------------------------------
alter table public.jobs
  add column if not exists expected_contractor_cost numeric(12, 2),
  add column if not exists expected_additional_expense numeric(12, 2),
  add column if not exists expected_expense_description text,
  add column if not exists occurrence_local_time text;

comment on column public.jobs.expected_contractor_cost is
  'Expected contractor/labor cost for this job occurrence only. Independent of series defaults after creation.';
comment on column public.jobs.expected_additional_expense is
  'Expected non-labor expenses for this job occurrence only.';
comment on column public.jobs.occurrence_local_time is
  'HH:MM local start time for recurring occurrence uniqueness when relevant.';

-- Tighten uniqueness: series + local date + local time (empty string when time unknown).
drop index if exists public.jobs_recurring_series_occurrence_uidx;

create unique index if not exists jobs_recurring_series_occurrence_uidx
  on public.jobs (
    recurring_series_id,
    occurrence_date,
    coalesce(occurrence_local_time, '')
  )
  where recurring_series_id is not null and occurrence_date is not null;

notify pgrst, 'reload schema';
