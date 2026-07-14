-- Payment-date fields and indexes used by dashboard cash, booked, and pending revenue metrics.
-- Safe to re-run: every addition uses IF NOT EXISTS.

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

create index if not exists invoices_org_paid_at_idx
  on public.invoices (organization_id, paid_at);

create index if not exists invoices_org_invoice_date_idx
  on public.invoices (organization_id, invoice_date);

create index if not exists invoices_org_due_date_idx
  on public.invoices (organization_id, due_date);

create index if not exists invoices_org_payment_status_idx
  on public.invoices (organization_id, payment_status);

-- Backfill only where safe. Do not invent historical paid_at from invoice dates.
update public.invoices
set amount_paid = coalesce(amount_paid, 0)
where amount_paid is null;

update public.invoices
set balance_due = greatest(0, coalesce(amount, 0) - coalesce(amount_paid, 0))
where balance_due is null;

update public.invoices
set invoice_date = (created_at at time zone 'utc')::date
where invoice_date is null and created_at is not null;

update public.invoices
set payment_status = case
  when lower(coalesce(status, '')) in ('cancelled', 'canceled') then 'cancelled'
  when coalesce(amount_paid, 0) >= coalesce(amount, 0) and coalesce(amount, 0) > 0 then 'paid'
  when coalesce(amount_paid, 0) > 0 then 'partially_paid'
  else 'unpaid'
end
where payment_status is null;
