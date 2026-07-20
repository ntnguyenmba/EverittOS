-- Direct job payments (optional invoicing) and customer photo report controls.

create table if not exists public.job_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  amount numeric not null check (amount > 0),
  paid_at timestamptz not null,
  payment_method text,
  payment_reference text,
  notes text,
  source text not null default 'recorded' check (source in ('recorded', 'adjustment')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_payments_org_paid_at_idx
  on public.job_payments (organization_id, paid_at desc);

create index if not exists job_payments_job_id_idx
  on public.job_payments (job_id, paid_at desc);

create index if not exists job_payments_invoice_id_idx
  on public.job_payments (invoice_id)
  where invoice_id is not null;

alter table public.job_payments enable row level security;

drop policy if exists job_payments_org_select on public.job_payments;
create policy job_payments_org_select on public.job_payments
  for select using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and active = true
    )
  );

drop policy if exists job_payments_org_insert on public.job_payments;
create policy job_payments_org_insert on public.job_payments
  for insert with check (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and active = true
      and role in ('owner', 'admin', 'manager')
    )
  );

drop policy if exists job_payments_org_update on public.job_payments;
create policy job_payments_org_update on public.job_payments
  for update using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and active = true
      and role in ('owner', 'admin', 'manager')
    )
  );

drop policy if exists job_payments_org_delete on public.job_payments;
create policy job_payments_org_delete on public.job_payments
  for delete using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and active = true
      and role in ('owner', 'admin', 'manager')
    )
  );

-- Photo customer visibility (default internal only for all existing rows).
alter table public.job_photos
  add column if not exists customer_visible boolean not null default false;

alter table public.job_photos
  add column if not exists customer_caption text;

create index if not exists job_photos_customer_visible_idx
  on public.job_photos (job_id, customer_visible)
  where customer_visible = true;

-- Customer report share links.
alter table public.job_reports
  add column if not exists share_token text;

alter table public.job_reports
  add column if not exists share_created_at timestamptz;

alter table public.job_reports
  add column if not exists share_revoked_at timestamptz;

alter table public.job_reports
  add column if not exists customer_completion_notes text;

alter table public.job_reports
  add column if not exists report_locale text;

create unique index if not exists job_reports_share_token_uidx
  on public.job_reports (share_token)
  where share_token is not null;
