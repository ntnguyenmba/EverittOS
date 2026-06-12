-- Simple financial tracking: expenses, job labor, invoice payments, receipt storage
-- Not full bookkeeping — performance visibility for service businesses.

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  worker_id uuid references public.workers (id) on delete set null,
  date date not null default current_date,
  category text not null,
  vendor text,
  description text,
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  payment_method text,
  receipt_url text,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses add constraint expenses_category_check check (
  category in (
    'Fuel',
    'Supplies',
    'Materials',
    'Equipment rental',
    'Subcontractor payment',
    'Tools',
    'Vehicle',
    'Marketing',
    'Office',
    'Insurance',
    'Other'
  )
);

create index if not exists expenses_organization_id_idx on public.expenses (organization_id);
create index if not exists expenses_job_id_idx on public.expenses (job_id);
create index if not exists expenses_customer_id_idx on public.expenses (customer_id);
create index if not exists expenses_worker_id_idx on public.expenses (worker_id);
create index if not exists expenses_date_idx on public.expenses (date);
create index if not exists expenses_category_idx on public.expenses (category);

-- ---------------------------------------------------------------------------
-- Job labor
-- ---------------------------------------------------------------------------
create table if not exists public.job_labor (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  worker_id uuid references public.workers (id) on delete set null,
  worker_name text,
  hours numeric(10, 2) not null default 0 check (hours >= 0),
  hourly_cost numeric(12, 2) not null default 0 check (hourly_cost >= 0),
  total_cost numeric(12, 2) not null default 0 check (total_cost >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_labor_organization_id_idx on public.job_labor (organization_id);
create index if not exists job_labor_job_id_idx on public.job_labor (job_id);
create index if not exists job_labor_worker_id_idx on public.job_labor (worker_id);

-- ---------------------------------------------------------------------------
-- Invoices (create or extend legacy table)
-- ---------------------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  client_user_id uuid references auth.users (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  amount numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null default 0,
  status text not null default 'draft',
  due_date date,
  description text,
  notes text,
  invoice_date date default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invoices add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.invoices add column if not exists job_id uuid references public.jobs (id) on delete set null;
alter table public.invoices add column if not exists customer_id uuid references public.customers (id) on delete set null;
alter table public.invoices add column if not exists client_user_id uuid references auth.users (id) on delete set null;
alter table public.invoices add column if not exists user_id uuid references auth.users (id) on delete set null;
alter table public.invoices add column if not exists amount numeric(12, 2) not null default 0;
alter table public.invoices add column if not exists amount_paid numeric(12, 2) not null default 0;
alter table public.invoices add column if not exists status text not null default 'draft';
alter table public.invoices add column if not exists due_date date;
alter table public.invoices add column if not exists description text;
alter table public.invoices add column if not exists notes text;
alter table public.invoices add column if not exists invoice_date date default current_date;
alter table public.invoices add column if not exists created_at timestamptz not null default now();
alter table public.invoices add column if not exists updated_at timestamptz not null default now();

create index if not exists invoices_organization_id_idx on public.invoices (organization_id);
create index if not exists invoices_job_id_idx on public.invoices (job_id);
create index if not exists invoices_customer_id_idx on public.invoices (customer_id);
create index if not exists invoices_status_idx on public.invoices (status);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_financial_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists expenses_touch_updated_at on public.expenses;
create trigger expenses_touch_updated_at
  before update on public.expenses
  for each row execute function public.touch_financial_row_updated_at();

drop trigger if exists job_labor_touch_updated_at on public.job_labor;
create trigger job_labor_touch_updated_at
  before update on public.job_labor
  for each row execute function public.touch_financial_row_updated_at();

drop trigger if exists invoices_touch_updated_at on public.invoices;
create trigger invoices_touch_updated_at
  before update on public.invoices
  for each row execute function public.touch_financial_row_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.expenses enable row level security;
alter table public.job_labor enable row level security;
alter table public.invoices enable row level security;

drop policy if exists expenses_org_select on public.expenses;
create policy expenses_org_select on public.expenses
  for select using (public.is_org_member(organization_id));

drop policy if exists expenses_org_write on public.expenses;
create policy expenses_org_write on public.expenses
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists job_labor_org_select on public.job_labor;
create policy job_labor_org_select on public.job_labor
  for select using (public.is_org_member(organization_id));

drop policy if exists job_labor_org_write on public.job_labor;
create policy job_labor_org_write on public.job_labor
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists invoices_org_manage on public.invoices;
create policy invoices_org_manage on public.invoices
  for all using (
    organization_id is not null and public.can_manage_organization(organization_id)
  )
  with check (
    organization_id is not null and public.can_manage_organization(organization_id)
  );

drop policy if exists invoices_org_select on public.invoices;
create policy invoices_org_select on public.invoices
  for select using (
    organization_id is not null and public.is_org_member(organization_id)
  );

drop policy if exists invoices_client_select on public.invoices;
create policy invoices_client_select on public.invoices
  for select using (
    client_user_id = auth.uid()
    or (
      job_id is not null
      and public.client_can_view_job(job_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Expense receipt storage (private bucket, org-scoped reads)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-receipts',
  'expense-receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists expense_receipts_storage_insert on storage.objects;
create policy expense_receipts_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists expense_receipts_storage_select on storage.objects;
create policy expense_receipts_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'expense-receipts'
    and exists (
      select 1
      from public.expenses e
      where e.receipt_url = name
        and public.is_org_member(e.organization_id)
    )
  );

drop policy if exists expense_receipts_storage_delete on storage.objects;
create policy expense_receipts_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'expense-receipts'
    and exists (
      select 1
      from public.expenses e
      where e.receipt_url = name
        and public.is_org_member(e.organization_id)
    )
  );
