-- Allow jobs to be cancelled without deleting the job record.
-- Safe to run more than once.

alter table public.jobs drop constraint if exists jobs_status_check;

alter table public.jobs
  add constraint jobs_status_check
  check (
    status is null
    or status in (
      'new',
      'pending',
      'assigned',
      'scheduled',
      'in_progress',
      'completed',
      'done',
      'complete',
      'closed',
      'cancelled',
      'canceled'
    )
  );
