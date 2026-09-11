-- Manual bookkeeping entries that are separate from job, invoice, and payroll records.
-- These represent actual cash received or paid and are included in Bookkeeping totals.

create table if not exists public.bookkeeping_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entry_type text not null check (entry_type in ('income', 'worker_payment', 'expense')),
  entry_date date not null default current_date,
  amount numeric(12, 2) not null check (amount > 0),
  title text,
  counterparty text,
  category text,
  payment_method text,
  notes text,
  job_id uuid references public.jobs (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookkeeping_entries_org_date_idx
  on public.bookkeeping_entries (organization_id, entry_date desc);
create index if not exists bookkeeping_entries_org_type_idx
  on public.bookkeeping_entries (organization_id, entry_type);
create index if not exists bookkeeping_entries_job_id_idx
  on public.bookkeeping_entries (job_id);

create or replace function public.touch_bookkeeping_entry_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bookkeeping_entries_touch_updated_at on public.bookkeeping_entries;
create trigger bookkeeping_entries_touch_updated_at
  before update on public.bookkeeping_entries
  for each row execute function public.touch_bookkeeping_entry_updated_at();

alter table public.bookkeeping_entries enable row level security;

drop policy if exists bookkeeping_entries_finance_select on public.bookkeeping_entries;
create policy bookkeeping_entries_finance_select on public.bookkeeping_entries
  for select to authenticated
  using (public.can_manage_organization(organization_id));

drop policy if exists bookkeeping_entries_finance_insert on public.bookkeeping_entries;
create policy bookkeeping_entries_finance_insert on public.bookkeeping_entries
  for insert to authenticated
  with check (
    public.can_manage_organization(organization_id)
    and (created_by is null or created_by = auth.uid())
  );

drop policy if exists bookkeeping_entries_finance_update on public.bookkeeping_entries;
create policy bookkeeping_entries_finance_update on public.bookkeeping_entries
  for update to authenticated
  using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));

drop policy if exists bookkeeping_entries_finance_delete on public.bookkeeping_entries;
create policy bookkeeping_entries_finance_delete on public.bookkeeping_entries
  for delete to authenticated
  using (public.can_manage_organization(organization_id));
