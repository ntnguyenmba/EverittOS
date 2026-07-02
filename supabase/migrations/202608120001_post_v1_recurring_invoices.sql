-- Recurring invoice foundation without visual changes.

create extension if not exists "pgcrypto";

create table if not exists public.recurring_invoice_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  job_id uuid references public.jobs (id) on delete set null,
  title text not null default 'Recurring invoice',
  amount numeric(12, 2) not null default 0,
  cadence text not null default 'monthly',
  next_run_on date,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recurring_invoice_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  template_id uuid not null references public.recurring_invoice_templates (id) on delete cascade,
  invoice_id uuid references public.invoices (id) on delete set null,
  run_for_date date not null default current_date,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists recurring_invoice_templates_org_idx on public.recurring_invoice_templates (organization_id, active, next_run_on);
create index if not exists recurring_invoice_runs_org_idx on public.recurring_invoice_runs (organization_id, run_for_date desc);

alter table public.recurring_invoice_templates enable row level security;
alter table public.recurring_invoice_runs enable row level security;
