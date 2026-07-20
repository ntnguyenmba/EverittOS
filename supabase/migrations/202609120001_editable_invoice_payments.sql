-- Allow authorized staff to correct invoice payment ledger entries while keeping
-- invoice and outbound document summary fields synchronized automatically.

alter table public.invoice_payments
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_invoice_payment_updated_at()
returns trigger
language plpgsql
set