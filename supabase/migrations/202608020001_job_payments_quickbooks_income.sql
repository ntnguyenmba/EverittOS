alter table public.job_payments
  add column if not exists quickbooks_sales_receipt_id text;

alter table public.job_payments
  add column if not exists quickbooks_sync_token text;

create index if not exists job_payments_quickbooks_sales_receipt_idx
  on public.job_payments (organization_id, quickbooks_sales_receipt_id)
  where quickbooks_sales_receipt_id is not null;
