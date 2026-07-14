# Supabase SQL to run

Paste the following into the Supabase SQL editor for production. Every statement is idempotent (`IF NOT EXISTS` / guarded updates).

## Required finance + payment fields

```sql
-- Forward-only reconciliation for invoice payment fields, indexes, and constraints.
-- Complements prior migrations. Safe to re-run.

alter table public.invoices
  add column if not exists amount_paid numeric(12, 2) not null default 0,
  add column if not exists balance_due numeric(12, 2),
  add column if not exists payment_status text,
  add column if not exists invoice_date date,
  add column if not exists due_date date,
  add column if not exists paid_at timestamptz,
  add column if not exists last_payment_at timestamptz,
  add column if not exists payment_method text,
  add column if not exists payment_reference text,
  add column if not exists payment_notes text;

alter table public.outbound_documents
  add column if not exists amount_paid numeric(12, 2) default 0,
  add column if not exists balance_due numeric(12, 2),
  add column if not exists payment_status text,
  add column if not exists due_date date,
  add column if not exists invoice_date date,
  add column if not exists paid_at timestamptz,
  add column if not exists last_payment_at timestamptz,
  add column if not exists payment_method text,
  add column if not exists payment_reference text,
  add column if not exists payment_notes text;

create index if not exists invoices_org_paid_at_idx
  on public.invoices (organization_id, paid_at);

create index if not exists invoices_org_invoice_date_idx
  on public.invoices (organization_id, invoice_date);

create index if not exists invoices_org_due_date_idx
  on public.invoices (organization_id, due_date);

create index if not exists invoices_org_payment_status_idx
  on public.invoices (organization_id, payment_status);

create index if not exists invoices_paid_at_idx
  on public.invoices (paid_at);

create index if not exists invoices_invoice_date_idx
  on public.invoices (invoice_date);

create index if not exists invoices_due_date_idx
  on public.invoices (due_date);

create index if not exists invoices_payment_status_idx
  on public.invoices (payment_status);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'invoices_amount_nonnegative'
  ) then
    alter table public.invoices
      add constraint invoices_amount_nonnegative check (amount is null or amount >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'invoices_amount_paid_nonnegative'
  ) then
    alter table public.invoices
      add constraint invoices_amount_paid_nonnegative check (amount_paid is null or amount_paid >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'invoices_balance_due_nonnegative'
  ) then
    alter table public.invoices
      add constraint invoices_balance_due_nonnegative check (balance_due is null or balance_due >= 0);
  end if;
end $$;

update public.invoices
set amount_paid = coalesce(amount_paid, 0)
where amount_paid is null;

update public.invoices
set balance_due = greatest(0, coalesce(amount, 0) - coalesce(amount_paid, 0))
where balance_due is null
   or balance_due <> greatest(0, coalesce(amount, 0) - coalesce(amount_paid, 0));

update public.invoices
set invoice_date = (created_at at time zone 'utc')::date
where invoice_date is null and created_at is not null;

update public.invoices
set payment_status = case
  when lower(coalesce(status, '')) in ('cancelled', 'canceled') then 'cancelled'
  when coalesce(amount_paid, 0) >= coalesce(amount, 0) and coalesce(amount, 0) > 0 then 'paid'
  when coalesce(amount_paid, 0) > 0
    and due_date is not null
    and due_date < current_date then 'overdue'
  when coalesce(amount_paid, 0) > 0 then 'partially_paid'
  when due_date is not null and due_date < current_date and coalesce(amount, 0) > 0 then 'overdue'
  else 'unpaid'
end
where payment_status is null
   or payment_status not in ('unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled');
```

## Contractor classification (if not already applied)

Also run:

`supabase/migrations/202609080001_contractor_classification.sql`

## Notes

- Do **not** invent `paid_at` from invoice dates for legacy paid rows. Enter historical payment dates in the UI where needed.
- After running SQL, redeploy/reload the app and verify dashboard Cash Collected vs Booked Revenue on a few known invoices.
- Migration file in repo: `supabase/migrations/202609090001_invoice_payment_finance_reconcile.sql`
