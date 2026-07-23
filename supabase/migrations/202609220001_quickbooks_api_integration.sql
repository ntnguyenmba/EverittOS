-- QuickBooks Online API integration: external IDs, sync diagnostics, token metadata, tighter RLS.

alter table public.quickbooks_connections
  add column if not exists company_name text,
  add column if not exists last_error text,
  add column if not exists refresh_token_expires_at timestamptz;

alter table public.quickbooks_sync_logs
  add column if not exists intuit_tid text,
  add column if not exists http_status integer,
  add column if not exists qb_error_code text,
  add column if not exists fault_type text;

alter table public.customers
  add column if not exists quickbooks_customer_id text,
  add column if not exists quickbooks_sync_token text;

alter table public.invoices
  add column if not exists quickbooks_invoice_id text,
  add column if not exists quickbooks_sync_token text;

create index if not exists customers_org_qb_customer_id_idx
  on public.customers (organization_id, quickbooks_customer_id)
  where quickbooks_customer_id is not null;

create index if not exists invoices_org_qb_invoice_id_idx
  on public.invoices (organization_id, quickbooks_invoice_id)
  where quickbooks_invoice_id is not null;

-- Tokens must not be readable by ordinary clients via the Supabase anon/authenticated key.
-- Server routes that need tokens or connection metadata use the service role (bypasses RLS).
-- With RLS enabled and no client policies, authenticated users cannot select token columns.
drop policy if exists quickbooks_connections_org_select on public.quickbooks_connections;
drop policy if exists quickbooks_connections_org_write on public.quickbooks_connections;

drop policy if exists quickbooks_sync_logs_org_select on public.quickbooks_sync_logs;
drop policy if exists quickbooks_sync_logs_org_write on public.quickbooks_sync_logs;

create policy quickbooks_sync_logs_org_select on public.quickbooks_sync_logs
  for select using (public.is_org_member(organization_id));

create policy quickbooks_sync_logs_org_write on public.quickbooks_sync_logs
  for all using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));

comment on table public.quickbooks_connections is
  'QuickBooks OAuth tokens. RLS enabled with no authenticated policies; access only via service role on the server. Tokens are not encrypted at the application layer.';
comment on column public.quickbooks_connections.access_token is
  'QuickBooks access token. Service-role server access only.';
comment on column public.quickbooks_connections.refresh_token is
  'QuickBooks refresh token. Service-role server access only.';
comment on column public.quickbooks_sync_logs.intuit_tid is
  'Intuit troubleshooting id from intuit_tid response header.';
