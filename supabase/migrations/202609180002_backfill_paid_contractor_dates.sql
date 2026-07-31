-- Ensure contractor payments marked paid participate in cash reporting.
-- Older rows may have payment_status = 'paid' but no paid_at timestamp.

update public.job_labor
set paid_at = coalesce(updated_at, created_at, now())
where lower(coalesce(payment_status, '')) = 'paid'
  and paid_at is null;

-- Keep future rows internally consistent even when written outside the app API.
create or replace function public.normalize_job_labor_payment_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if lower(coalesce(new.payment_status, 'unpaid')) = 'paid' then
    new.paid_at := coalesce(new.paid_at, now());
  elsif lower(coalesce(new.payment_status, 'unpaid')) in ('unpaid', 'pending') then
    new.paid_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists job_labor_normalize_payment_fields on public.job_labor;
create trigger job_labor_normalize_payment_fields
before insert or update of payment_status, paid_at on public.job_labor
for each row
execute function public.normalize_job_labor_payment_fields();

comment on function public.normalize_job_labor_payment_fields() is
  'Keeps job_labor payment_status and paid_at consistent for dashboard cash reporting.';
