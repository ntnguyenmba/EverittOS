-- Last-line protection for job financial history.
-- Applies to every DELETE path, including legacy/fallback API code.

create or replace function public.guard_job_delete_financial_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.invoices i
    where i.organization_id = old.organization_id and i.job_id = old.id
  ) or exists (
    select 1 from public.job_payments p
    where p.organization_id = old.organization_id and p.job_id = old.id
  ) or exists (
    select 1 from public.job_labor l
    where l.organization_id = old.organization_id and l.job_id = old.id
  ) or exists (
    select 1 from public.expenses e
    where e.organization_id = old.organization_id and e.job_id = old.id
  ) then
    raise exception 'Jobs with invoices, payments, worker labor, or expenses cannot be permanently deleted. Cancel the job instead so financial history stays accurate.';
  end if;

  return old;
end;
$$;

drop trigger if exists jobs_guard_financial_delete on public.jobs;
create trigger jobs_guard_financial_delete
before delete on public.jobs
for each row
execute function public.guard_job_delete_financial_history();

comment on function public.guard_job_delete_financial_history() is
  'Blocks every hard-delete path for jobs that have invoice, payment, labor, or expense history.';

notify pgrst, 'reload schema';
