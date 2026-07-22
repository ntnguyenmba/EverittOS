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
