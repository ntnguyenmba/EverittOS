-- Post-v1 backend repair: idempotent RLS, validation constraints, indexes.

-- Recurring invoices
drop policy if exists recurring_invoice_templates_org_select on public.recurring_invoice_templates;
drop policy if exists recurring_invoice_templates_org_write on public.recurring_invoice_templates;
drop policy if exists recurring_invoice_runs_org_select on public.recurring_invoice_runs;
drop policy if exists recurring_invoice_runs_org_write on public.recurring_invoice_runs;

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

alter table public.recurring_invoice_templates
  drop constraint if exists recurring_invoice_templates_cadence_check;

alter table public.recurring_invoice_templates
  add constraint recurring_invoice_templates_cadence_check
  check (cadence in ('weekly', 'monthly', 'quarterly', 'yearly'));

create index if not exists recurring_invoice_runs_template_idx
  on public.recurring_invoice_runs (template_id, created_at desc);

-- Customer messaging
drop policy if exists customer_message_threads_org_select on public.customer_message_threads;
drop policy if exists customer_message_threads_org_write on public.customer_message_threads;
drop policy if exists customer_messages_org_select on public.customer_messages;
drop policy if exists customer_messages_org_write on public.customer_messages;

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

alter table public.customer_messages
  drop constraint if exists customer_messages_direction_check;

alter table public.customer_messages
  add constraint customer_messages_direction_check
  check (direction in ('outbound', 'inbound'));

alter table public.customer_messages
  drop constraint if exists customer_messages_status_check;

alter table public.customer_messages
  add constraint customer_messages_status_check
  check (status in ('draft', 'sent', 'failed'));

-- Inventory
drop policy if exists inventory_items_org_select on public.inventory_items;
drop policy if exists inventory_items_org_write on public.inventory_items;
drop policy if exists inventory_adjustments_org_select on public.inventory_adjustments;
drop policy if exists inventory_adjustments_org_write on public.inventory_adjustments;

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

alter table public.inventory_items
  drop constraint if exists inventory_items_item_type_check;

alter table public.inventory_items
  add constraint inventory_items_item_type_check
  check (item_type in ('supply', 'equipment'));

alter table public.inventory_adjustments
  drop constraint if exists inventory_adjustments_type_check;

alter table public.inventory_adjustments
  add constraint inventory_adjustments_type_check
  check (adjustment_type in ('purchase', 'used', 'count', 'loss', 'repair', 'retired'));

create index if not exists inventory_items_low_stock_idx
  on public.inventory_items (organization_id, active, reorder_level, quantity);

-- QuickBooks + routes (idempotent policy refresh)
drop policy if exists quickbooks_connections_org_select on public.quickbooks_connections;
drop policy if exists quickbooks_connections_org_write on public.quickbooks_connections;
drop policy if exists quickbooks_sync_logs_org_select on public.quickbooks_sync_logs;
drop policy if exists quickbooks_sync_logs_org_write on public.quickbooks_sync_logs;
drop policy if exists route_optimization_runs_org_select on public.route_optimization_runs;
drop policy if exists route_optimization_runs_org_write on public.route_optimization_runs;

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

create policy route_optimization_runs_org_select on public.route_optimization_runs
  for select using (public.is_org_member(organization_id));

create policy route_optimization_runs_org_write on public.route_optimization_runs
  for all using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));
