-- Outbound documents: unified send workflow for reviews, proposals, estimates, invoices, messages

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
    doc_type in ('review', 'proposal', 'estimate', 'invoice', 'message')
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

alter table public.outbound_documents enable row level security;
alter table public.outbound_sent_history enable row level security;

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

-- Delivery fields on invoices for sent-history alignment
alter table public.invoices add column if not exists recipient_email text;
alter table public.invoices add column if not exists sent_at timestamptz;
alter table public.invoices add column if not exists delivery_status text;
alter table public.invoices add column if not exists failure_reason text;

alter table public.proposals add column if not exists recipient_email text;
alter table public.proposals add column if not exists failure_reason text;

alter table public.review_requests add column if not exists scheduled_at timestamptz;
alter table public.review_requests add column if not exists failure_reason text;
