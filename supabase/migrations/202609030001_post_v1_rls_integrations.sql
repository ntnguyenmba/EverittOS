-- RLS policies for post-v1 foundations, QuickBooks, and route optimization.

-- Recurring invoices
create policy recurring_invoice_templates_org_select on public.recurring_invoice_templates
  for select using (public.is_org_member(organization_id));

create policy recurring_invoice_templates_org_write on public.recurring_invoice_templates
  for all using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));

create policy recurring_invoice_runs_org_select on public.recurring_invoice_runs
  for select using (public.is_org_member(organization_id));

create policy recurring_invoice_runs_org_write on public.recurring_invoice_runs
  for all using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));

-- Customer messaging
create policy customer_message_threads_org_select on public.customer_message_threads
  for select using (public.is_org_member(organization_id));

create policy customer_message_threads_org_write on public.customer_message_threads
  for all using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));

create policy customer_messages_org_select on public.customer_messages
  for select using (public.is_org_member(organization_id));

create policy customer_messages_org_write on public.customer_messages
  for all using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));

-- Inventory
create policy inventory_items_org_select on public.inventory_items
  for select using (public.is_org_member(organization_id));

create policy inventory_items_org_write on public.inventory_items
  for all using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));

create policy inventory_adjustments_org_select on public.inventory_adjustments
  for select using (public.is_org_member(organization_id));

create policy inventory_adjustments_org_write on public.inventory_adjustments
  for all using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));

-- QuickBooks integration
create table if not exists public.quickbooks_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations (id) on delete cascade,
  provider text not null default 'quickbooks',
  status text not null default 'disconnected',
  realm_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  sync_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quickbooks_sync_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  direction text not null default 'export',
  status text not null default 'pending',
  external_id text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists quickbooks_sync_logs_org_idx on public.quickbooks_sync_logs (organization_id, created_at desc);

alter table public.quickbooks_connections enable row level security;
alter table public.quickbooks_sync_logs enable row level security;

create policy quickbooks_connections_org_select on public.quickbooks_connections
  for select using (public.is_org_member(organization_id));

create policy quickbooks_connections_org_write on public.quickbooks_connections
  for all using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));

create policy quickbooks_sync_logs_org_select on public.quickbooks_sync_logs
  for select using (public.is_org_member(organization_id));

create policy quickbooks_sync_logs_org_write on public.quickbooks_sync_logs
  for all using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));

-- Route optimization
create table if not exists public.route_optimization_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  service_date date not null,
  status text not null default 'draft',
  input_job_ids uuid[] not null default '{}'::uuid[],
  optimized_stops jsonb not null default '[]'::jsonb,
  total_distance_miles numeric(10, 2),
  total_drive_minutes numeric(10, 2),
  provider text not null default 'heuristic',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists route_optimization_runs_org_idx on public.route_optimization_runs (organization_id, service_date desc);

alter table public.route_optimization_runs enable row level security;

create policy route_optimization_runs_org_select on public.route_optimization_runs
  for select using (public.is_org_member(organization_id));

create policy route_optimization_runs_org_write on public.route_optimization_runs
  for all using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));
