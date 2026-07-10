-- Contractor payment tracking for job labor entries.
-- Existing rows remain unpaid until explicitly marked paid.

alter table public.job_labor
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists paid_at timestamptz,
  add column if not exists payment_method text,
  add column if not exists payment_reference text;

alter table public.job_labor
  drop constraint if exists job_labor_payment_status_check;

alter table public.job_labor
  add constraint job_labor_payment_status_check
  check (payment_status in ('unpaid', 'pending', 'paid'));

create index if not exists job_labor_payment_status_idx
  on public.job_labor (organization_id, payment_status);

create index if not exists job_labor_paid_at_idx
  on public.job_labor (organization_id, paid_at);

comment on column public.job_labor.payment_status is
  'Whether contractor pay is unpaid, pending, or paid.';

comment on column public.job_labor.paid_at is
  'Timestamp when contractor pay was marked paid.';

comment on column public.job_labor.payment_method is
  'Optional payment method such as Zelle, check, cash, or ACH.';

comment on column public.job_labor.payment_reference is
  'Optional confirmation number, memo, or payment reference.';
