-- =============================================================================
-- EverittOS manual schema repair
-- Run this entire file once in the Supabase SQL Editor (safe to re-run).
-- Creates or repairs every app-referenced table that may be missing on production.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- RLS helpers (required by policies below)
-- ---------------------------------------------------------------------------
create or replace function public.member_role_in_org(org_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.organization_members
  where organization_id = org_id and user_id = auth.uid() and active = true
  limit 1;
$$;

create or replace function public.can_manage_organization(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.member_role_in_org(org_id) in ('owner', 'admin', 'manager');
$$;

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id and user_id = auth.uid() and active = true
  );
$$;

-- ---------------------------------------------------------------------------
-- Proposals (estimates share this table)
-- ---------------------------------------------------------------------------
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  job_id uuid references public.jobs (id) on delete set null,
  title text not null,
  status text not null default 'draft',
  amount numeric(12, 2),
  body text,
  sent_at timestamptz,
  approved_at timestamptz,
  recipient_email text,
  failure_reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.proposals add column if not exists recipient_email text;
alter table public.proposals add column if not exists failure_reason text;
alter table public.proposals add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.proposals add column if not exists created_at timestamptz not null default now();
alter table public.proposals add column if not exists updated_at timestamptz not null default now();

create index if not exists proposals_org_idx on public.proposals (organization_id, status);

-- ---------------------------------------------------------------------------
-- Template library (app queries template_library, not templates)
-- ---------------------------------------------------------------------------
create table if not exists public.template_library (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  category text not null,
  title text not null,
  body text not null default '',
  version int not null default 1,
  parent_id uuid references public.template_library (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.template_library add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.template_library add column if not exists updated_at timestamptz not null default now();

create index if not exists template_library_org_idx on public.template_library (organization_id, category);

-- ---------------------------------------------------------------------------
-- Review requests & customer reviews
-- ---------------------------------------------------------------------------
create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  customer_email text,
  status text not null default 'pending',
  message text,
  sent_at timestamptz,
  submitted_at timestamptz,
  scheduled_at timestamptz,
  failure_reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.review_requests add column if not exists scheduled_at timestamptz;
alter table public.review_requests add column if not exists failure_reason text;
alter table public.review_requests add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.review_requests add column if not exists updated_at timestamptz not null default now();

create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  review_request_id uuid references public.review_requests (id) on delete set null,
  rating int check (rating >= 1 and rating <= 5),
  body text,
  status text not null default 'submitted',
  created_at timestamptz not null default now()
);

alter table public.customer_reviews add column if not exists organization_id uuid references public.organizations (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- Invoices & expenses (financial tracking)
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
  recipient_email text,
  sent_at timestamptz,
  delivery_status text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invoices add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.invoices add column if not exists job_id uuid references public.jobs (id) on delete set null;
alter table public.invoices add column if not exists customer_id uuid references public.customers (id) on delete set null;
alter table public.invoices add column if not exists amount numeric(12, 2) not null default 0;
alter table public.invoices add column if not exists amount_paid numeric(12, 2) not null default 0;
alter table public.invoices add column if not exists status text not null default 'draft';
alter table public.invoices add column if not exists recipient_email text;
alter table public.invoices add column if not exists sent_at timestamptz;
alter table public.invoices add column if not exists delivery_status text;
alter table public.invoices add column if not exists failure_reason text;
alter table public.invoices add column if not exists created_at timestamptz not null default now();
alter table public.invoices add column if not exists updated_at timestamptz not null default now();

create index if not exists invoices_organization_id_idx on public.invoices (organization_id);
create index if not exists invoices_job_id_idx on public.invoices (job_id);
create index if not exists invoices_status_idx on public.invoices (status);

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

alter table public.expenses add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.expenses add column if not exists updated_at timestamptz not null default now();

create index if not exists expenses_organization_id_idx on public.expenses (organization_id);
create index if not exists expenses_job_id_idx on public.expenses (job_id);

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

-- ---------------------------------------------------------------------------
-- Activity logs (referenced across send workflows)
-- ---------------------------------------------------------------------------
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  actor_name text,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  message text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.activity_logs add column if not exists organization_id uuid references public.organizations (id) on delete cascade;

create index if not exists activity_logs_org_idx on public.activity_logs (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Outbound documents (reviews, proposals, estimates, invoices, messages)
-- ---------------------------------------------------------------------------
create table if not exists public.outbound_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  doc_type text not null,
  status text not null default 'draft',
  recipient_email text,
  recipient_name text,
  subject text,
  body text,
  customer_id uuid references public.customers (id) on delete set null,
  job_id uuid references public.jobs (id) on delete set null,
  amount numeric(12, 2),
  scheduled_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  source_entity_type text,
  source_entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outbound_documents_doc_type_check check (
    doc_type in ('review', 'proposal', 'estimate', 'invoice', 'message', 'receipt')
  ),
  constraint outbound_documents_status_check check (
    status in ('draft', 'scheduled', 'sent', 'failed')
  )
);

create index if not exists outbound_documents_org_type_status_idx
  on public.outbound_documents (organization_id, doc_type, status, updated_at desc);

create index if not exists outbound_documents_scheduled_idx
  on public.outbound_documents (organization_id, scheduled_at)
  where status = 'scheduled';

create table if not exists public.outbound_sent_history (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.outbound_documents (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_type text not null,
  recipient_email text,
  subject text,
  body_snapshot text,
  delivery_provider text,
  external_message_id text,
  error_message text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint outbound_sent_history_event_type_check check (
    event_type in ('sent', 'failed', 'scheduled', 'retry')
  )
);

create index if not exists outbound_sent_history_doc_idx
  on public.outbound_sent_history (document_id, created_at desc);

create index if not exists outbound_sent_history_org_idx
  on public.outbound_sent_history (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_outbound_document_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists outbound_documents_touch_updated_at on public.outbound_documents;
create trigger outbound_documents_touch_updated_at
  before update on public.outbound_documents
  for each row execute function public.touch_outbound_document_updated_at();

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
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.proposals enable row level security;
alter table public.template_library enable row level security;
alter table public.review_requests enable row level security;
alter table public.customer_reviews enable row level security;
alter table public.invoices enable row level security;
alter table public.expenses enable row level security;
alter table public.job_labor enable row level security;
alter table public.activity_logs enable row level security;
alter table public.outbound_documents enable row level security;
alter table public.outbound_sent_history enable row level security;

drop policy if exists proposals_org on public.proposals;
create policy proposals_org on public.proposals for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists template_library_org on public.template_library;
create policy template_library_org on public.template_library for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists review_requests_org on public.review_requests;
create policy review_requests_org on public.review_requests for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists customer_reviews_org on public.customer_reviews;
create policy customer_reviews_org on public.customer_reviews for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists invoices_org_select on public.invoices;
create policy invoices_org_select on public.invoices
  for select using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists invoices_org_manage on public.invoices;
create policy invoices_org_manage on public.invoices
  for all using (organization_id is not null and public.can_manage_organization(organization_id))
  with check (organization_id is not null and public.can_manage_organization(organization_id));

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

drop policy if exists activity_logs_org_select on public.activity_logs;
create policy activity_logs_org_select on public.activity_logs
  for select using (public.is_org_member(organization_id));

drop policy if exists activity_logs_org_insert on public.activity_logs;
create policy activity_logs_org_insert on public.activity_logs
  for insert with check (public.is_org_member(organization_id));

drop policy if exists outbound_documents_org_select on public.outbound_documents;
create policy outbound_documents_org_select on public.outbound_documents
  for select using (public.is_org_member(organization_id));

drop policy if exists outbound_documents_org_write on public.outbound_documents;
create policy outbound_documents_org_write on public.outbound_documents
  for all using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));

drop policy if exists outbound_sent_history_org_select on public.outbound_sent_history;
create policy outbound_sent_history_org_select on public.outbound_sent_history
  for select using (public.is_org_member(organization_id));

drop policy if exists outbound_sent_history_org_write on public.outbound_sent_history;
create policy outbound_sent_history_org_write on public.outbound_sent_history
  for all using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));

-- Notify PostgREST to reload schema cache
notify pgrst, 'reload schema';
