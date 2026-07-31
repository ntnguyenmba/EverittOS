-- Finalize assignment-only contractor job access.
-- Keep record_shares available for legitimate non-job sharing, but prevent job shares
-- from granting contractors job visibility, job edits, or indirect customer visibility.

-- Contractors may read jobs only when directly assigned through jobs.assigned_to,
-- job_assignments, or a visit resolved by the application access model.
drop policy if exists jobs_team_work_read on public.jobs;
create policy jobs_team_work_read on public.jobs
  for select using (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
    or assigned_to = auth.uid()
    or public.is_assigned_to_job(id)
  );

-- Generic job updates remain limited to workspace managers and legacy record owners.
-- Assigned contractors use purpose-built workflow endpoints instead of updating jobs directly.
drop policy if exists jobs_team_work_update on public.jobs;
create policy jobs_team_work_update on public.jobs
  for update
  using (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
  )
  with check (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
  );

-- A contractor can see the customer attached to an assigned job, but a legacy shared
-- job no longer exposes that customer. Explicit customer shares remain supported.
drop policy if exists customers_team_work_read on public.customers;
create policy customers_team_work_read on public.customers
  for select using (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
    or public.record_shared_with_current_user(organization_id, 'customer', id)
    or exists (
      select 1
      from public.jobs j
      where j.customer_id = customers.id
        and j.organization_id = customers.organization_id
        and (
          j.assigned_to = auth.uid()
          or j.user_id = auth.uid()
          or public.is_assigned_to_job(j.id)
        )
    )
  );

notify pgrst, 'reload schema';
