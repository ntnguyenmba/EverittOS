-- Individual invoice payment ledger for accurate period cash reporting.
-- Summary fields on invoices / outbound_documents remain for fast display.

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null,
  outbound_document_id uuid,
  amount numeric not null check (amount > 0),
  paid_at timestamptz not null default now(),
  payment_method text,
  payment_reference text,
  notes text,
  source text not null default 'recorded'
    check (source in ('recorded', 'legacy_backfill', 'adjustment')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists invoice_payments_org_paid_at_idx
  on public.invoice_payments (organization_id, paid_at);

create index if not exists invoice_payments_invoice_idx
  on public.invoice_payments (invoice_id);

create index if not exists invoice_payments_outbound_idx
  on public.invoice_payments (outbound_document_id);

-- Prevent duplicate legacy backfill rows for the same invoice.
create unique index if not exists invoice_payments_legacy_backfill_uidx
  on public.invoice_payments (invoice_id)
  where source = 'legacy_backfill';

alter table public.invoice_payments enable row level security;

drop policy if exists invoice_payments_select_member on public.invoice_payments;
create policy invoice_payments_select_member
  on public.invoice_payments
  for select
  to authenticated
  using (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

drop policy if exists invoice_payments_insert_member on public.invoice_payments;
create policy invoice_payments_insert_member
  on public.invoice_payments
  for insert
  to authenticated
  with check (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('owner', 'admin', 'manager')
    )
  );

-- Backfill one legacy payment row per invoice that already has amount_paid > 0.
-- Idempotent via unique index on (invoice_id) where source = legacy_backfill.
insert into public.invoice_payments (
  organization_id,
  invoice_id,
  amount,
  paid_at,
  payment_method,
  payment_reference,
  notes,
  source
)
select
  i.organization_id,
  i.id,
  least(greatest(coalesce(i.amount_paid, 0), 0), greatest(coalesce(i.amount, 0), coalesce(i.amount_paid, 0))),
  coalesce(i.paid_at, i.last_payment_at, i.updated_at, i.created_at, now()),
  i.payment_method,
  i.payment_reference,
  'Legacy payment backfill',
  'legacy_backfill'
from public.invoices i
where coalesce(i.amount_paid, 0) > 0
  and lower(coalesce(i.payment_status, i.status, '')) not in ('cancelled', 'canceled')
  and not exists (
    select 1 from public.invoice_payments p
    where p.invoice_id = i.id and p.source = 'legacy_backfill'
  );

comment on table public.invoice_payments is
  'Per-payment ledger for customer invoice cash. Paid to you dashboard metric prefers this table.';
