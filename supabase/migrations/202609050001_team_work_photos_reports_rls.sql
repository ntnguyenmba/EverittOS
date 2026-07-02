-- Align job_photos and job_reports RLS with jobs team work visibility.

drop policy if exists job_photos_select_role on public.job_photos;
drop policy if exists job_photos_own on public.job_photos;
drop policy if exists job_reports_org on public.job_reports;
drop policy if exists job_reports_owner_all on public.job_reports;

create policy job_photos_team_work_read on public.job_photos
  for select using (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
    or public.is_assigned_to_job(job_id)
    or (
      organization_id is not null
      and public.record_shared_with_current_user(organization_id, 'job', job_id)
    )
  );

create policy job_photos_team_work_write on public.job_photos
  for all using (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
    or public.is_assigned_to_job(job_id)
  )
  with check (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
    or public.is_assigned_to_job(job_id)
  );

create policy job_reports_team_work_read on public.job_reports
  for select using (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
    or public.is_assigned_to_job(job_id)
    or (
      organization_id is not null
      and public.record_shared_with_current_user(organization_id, 'job', job_id)
    )
  );

create policy job_reports_team_work_write on public.job_reports
  for all using (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
    or public.is_assigned_to_job(job_id)
  )
  with check (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
    or public.is_assigned_to_job(job_id)
  );
