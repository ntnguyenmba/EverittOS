-- Assigned customer RLS policies.
-- Owners, admins, and managers keep full customer control.
-- Contractors can read only customers connected to assigned jobs.

alter table public.customers enable row level security;

drop policy if exists customers_team_work_read on public.customers;
create policy customers_team_work_read on public.customers
  for select using (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
    or public.is_assigned_to_customer(id)
  );

drop policy if exists customers_team_work_insert on public.customers;
create policy customers_team_work_insert on public.customers
  for insert with check (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
  );

drop policy if exists customers_team_work_update on public.customers;
create policy customers_team_work_update on public.customers
  for update using (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
  ) with check (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
  );

drop policy if exists customers_team_work_delete on public.customers;
create policy customers_team_work_delete on public.customers
  for delete using (
    public.can_manage_org_work(organization_id)
  );

notify pgrst, 'reload schema';
