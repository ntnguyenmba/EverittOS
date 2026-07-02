-- Invoice payment tracking for outbound documents and linked invoices rows.

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

alter table public.invoices
  add column if not exists balance_due numeric(12, 2),
  add column if not exists payment_status text,
  add column if not exists payment_method text,
  add column if not exists payment_reference text,
  add column if not exists paid_at timestamptz,
  add column if not exists last_payment_at timestamptz,
  add column if not exists payment_notes text;
