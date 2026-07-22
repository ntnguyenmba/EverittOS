-- Tighten client invoice visibility so a client can only see invoices
-- whose job belongs to the same organization as the invoice.
-- Prevents cross-organization leakage if an invoice was incorrectly
-- bound to another org's job_id.

drop policy if exists invoices_client_select on public.invoices;
create policy invoices_client_select on public.invoices
  for select using (
    client_user_id = auth.uid()
    or (
      job_id is not null
      and public.client_can_view_job(job_id)
      and exists (
        select 1
        from public.jobs j
        where j.id = invoices.job_id
          and j.organization_id = invoices.organization_id
      )
    )
  );

-- Align expense and job_labor writes with invoice management:
-- only organization managers can mutate finance rows via the browser client.
-- Selects remain available to org members for dashboard/reporting views.

drop policy if exists expenses_org_write on public.expenses;
create policy expenses_org_write on public.expenses
  for all using (
    organization_id is not null and public.can_manage_organization(organization_id)
  )
  with check (
    organization_id is not null and public.can_manage_organization(organization_id)
  );

drop policy if exists job_labor_org_write on public.job_labor;
create policy job_labor_org_write on public.job_labor
  for all using (
    organization_id is not null and public.can_manage_organization(organization_id)
  )
  with check (
    organization_id is not null and public.can_manage_organization(organization_id)
  );
