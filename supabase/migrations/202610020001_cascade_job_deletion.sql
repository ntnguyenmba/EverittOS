-- Delete a job and all records that belong to it in one transaction.
-- Recurring deletion still preserves completed visits before the selected occurrence.

create or replace function public.permanently_delete_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
  v_org_id uuid;
  v_anchor date;
  v_job_ids uuid[] := array[]::uuid[];
  v_invoice_ids uuid[] := array[]::uuid[];
  v_outbound_ids uuid[] := array[]::uuid[];
  v_photo_paths text[] := array[]::text[];
  v_deleted_count integer := 0;
  v_series_ended boolean := false;
begin
  if auth.uid() is null then raise exception 'Sign in required.'; end if;

  select * into v_job from public.jobs where id = p_job_id;
  if not found then raise exception 'Job not found.'; end if;

  v_org_id := v_job.organization_id;
  if v_org_id is null or not public.can_manage_org_work(v_org_id) then
    raise exception 'You do not have permission to permanently delete this job.';
  end if;

  if v_job.recurring_series_id is null then
    v_job_ids := array[v_job.id];
  else
    v_anchor := coalesce(v_job.occurrence_date, v_job.start_date);
    if v_anchor is null then raise exception 'This recurring visit is missing its occurrence date.'; end if;

    select coalesce(array_agg(j.id), array[]::uuid[]) into v_job_ids
    from public.jobs j
    where j.organization_id = v_org_id
      and j.recurring_series_id = v_job.recurring_series_id
      and coalesce(j.occurrence_date, j.start_date) >= v_anchor
      and lower(coalesce(j.status, '')) not in ('completed', 'done', 'complete', 'closed');

    if not (v_job.id = any(v_job_ids))
       and lower(coalesce(v_job.status, '')) not in ('completed', 'done', 'complete', 'closed') then
      v_job_ids := array_prepend(v_job.id, v_job_ids);
    end if;

    if coalesce(array_length(v_job_ids, 1), 0) = 0 then
      raise exception 'Completed historical visits were preserved and there is nothing to delete.';
    end if;
  end if;

  select coalesce(array_agg(i.id), array[]::uuid[]) into v_invoice_ids
  from public.invoices i
  where i.organization_id = v_org_id and i.job_id = any(v_job_ids);

  select coalesce(array_agg(d.id), array[]::uuid[]) into v_outbound_ids
  from public.outbound_documents d
  where d.organization_id = v_org_id and d.job_id = any(v_job_ids);

  select coalesce(array_agg(p.storage_path) filter (where p.storage_path is not null), array[]::text[])
  into v_photo_paths
  from public.job_photos p
  where p.organization_id = v_org_id and p.job_id = any(v_job_ids);

  delete from public.invoice_payments
  where organization_id = v_org_id
    and (invoice_id = any(v_invoice_ids) or outbound_document_id = any(v_outbound_ids));

  delete from public.outbound_documents
  where organization_id = v_org_id and job_id = any(v_job_ids);

  delete from public.invoices
  where organization_id = v_org_id and job_id = any(v_job_ids);

  delete from public.job_payments
  where organization_id = v_org_id and job_id = any(v_job_ids);

  delete from public.job_labor
  where organization_id = v_org_id and job_id = any(v_job_ids);

  delete from public.expenses
  where organization_id = v_org_id and job_id = any(v_job_ids);

  if v_job.recurring_series_id is not null then
    update public.recurring_job_series
    set status = 'ended', end_date = (v_anchor - 1), next_generation_date = null, updated_at = now()
    where id = v_job.recurring_series_id and organization_id = v_org_id;
    v_series_ended := true;
  end if;

  delete from public.record_shares
  where organization_id = v_org_id and record_type = 'job' and record_id = any(v_job_ids);

  delete from public.jobs
  where organization_id = v_org_id and id = any(v_job_ids);

  get diagnostics v_deleted_count = row_count;
  if v_deleted_count = 0 then raise exception 'Job could not be deleted.'; end if;

  return jsonb_build_object(
    'ok', true,
    'deletedJobCount', v_deleted_count,
    'recurringSeriesEnded', v_series_ended,
    'deletedFromDate', case when v_series_ended then to_char(v_anchor, 'YYYY-MM-DD') else null end,
    'deletedJobIds', to_jsonb(v_job_ids),
    'photoStoragePaths', to_jsonb(v_photo_paths)
  );
end;
$$;

revoke all on function public.permanently_delete_job(uuid) from public;
grant execute on function public.permanently_delete_job(uuid) to authenticated;

comment on function public.permanently_delete_job(uuid) is
  'Atomically deletes a job and its linked financial, operational, and photo database records.';

notify pgrst, 'reload schema';
