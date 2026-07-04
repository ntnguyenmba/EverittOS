-- Manager operations access
-- Gives managers daily-operations visibility without owner/admin billing or org-settings control.
-- Safe to run more than once: every policy is dropped and recreated only when the table exists.

begin;

create or replace function public.everitt_user_has_org_role(
  target_organization_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members m
    where m.organization_id = target_organization_id
      and m.user_id = auth.uid()
      and lower(m.role::text) = any (allowed_roles)
  );
$$;

grant execute on function public.everitt_user_has_org_role(uuid, text[]) to authenticated;

-- Customers / leads: managers can see and manage company leads/customers.
do $$
begin
  if to_regclass('public.customers') is not null then
    drop policy if exists "Managers can view organization customers" on public.customers;
    create policy "Managers can view organization customers"
      on public.customers
      for select
      to authenticated
      using (public.everitt_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));

    drop policy if exists "Managers can create organization customers" on public.customers;
    create policy "Managers can create organization customers"
      on public.customers
      for insert
      to authenticated
      with check (public.everitt_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));

    drop policy if exists "Managers can update organization customers" on public.customers;
    create policy "Managers can update organization customers"
      on public.customers
      for update
      to authenticated
      using (public.everitt_user_has_org_role(organization_id, array['owner', 'admin', 'manager']))
      with check (public.everitt_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));
  end if;
end $$;

-- Jobs: managers can view, create, update, assign, and run daily job operations.
do $$
begin
  if to_regclass('public.jobs') is not null then
    drop policy if exists "Managers can view organization jobs" on public.jobs;
    create policy "Managers can view organization jobs"
      on public.jobs
      for select
      to authenticated
      using (public.everitt_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));

    drop policy if exists "Managers can create organization jobs" on public.jobs;
    create policy "Managers can create organization jobs"
      on public.jobs
      for insert
      to authenticated
      with check (public.everitt_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));

    drop policy if exists "Managers can update organization jobs" on public.jobs;
    create policy "Managers can update organization jobs"
      on public.jobs
      for update
      to authenticated
      using (public.everitt_user_has_org_role(organization_id, array['owner', 'admin', 'manager']))
      with check (public.everitt_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));
  end if;
end $$;

-- Team/workers: managers can view team workload and update daily scheduling fields.
do $$
begin
  if to_regclass('public.workers') is not null then
    drop policy if exists "Managers can view organization workers" on public.workers;
    create policy "Managers can view organization workers"
      on public.workers
      for select
      to authenticated
      using (public.everitt_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));

    drop policy if exists "Managers can update organization workers" on public.workers;
    create policy "Managers can update organization workers"
      on public.workers
      for update
      to authenticated
      using (public.everitt_user_has_org_role(organization_id, array['owner', 'admin', 'manager']))
      with check (public.everitt_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));
  end if;
end $$;

-- Organization members: managers can see team members, but not change roles or permissions.
do $$
begin
  if to_regclass('public.members') is not null then
    drop policy if exists "Managers can view organization members" on public.members;
    create policy "Managers can view organization members"
      on public.members
      for select
      to authenticated
      using (public.everitt_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));
  end if;
end $$;

-- Expenses, photos, and reports remain governed by existing plan and role policies.
-- Billing, subscriptions, organization ownership, owner transfer, and role changes should stay owner/admin only.

commit;
