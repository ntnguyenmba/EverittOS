-- Restrict job_labor SELECT so contractors only see their own pay rows.
-- Managers/owners keep org-wide visibility via can_manage_org_work / can_manage_organization.
-- Writes remain manager-only (see 202609160001).

drop policy if exists job_labor_org_select on public.job_labor;
create policy job_labor_org_select on public.job_labor
  for select using (
    (
      organization_id is not null
      and (
        public.can_manage_organization(organization_id)
        or public.can_manage_org_work(organization_id)
      )
    )
    or exists (
      select 1
      from public.workers w
      where w.id = job_labor.worker_id
        and w.auth_user_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
