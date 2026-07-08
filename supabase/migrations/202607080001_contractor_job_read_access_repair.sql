-- Repair contractor job read access for assigned and explicitly shared jobs.
-- Some production paths store jobs.assigned_to as a worker id while newer team-work
-- policies also check assigned_to against auth.uid(). This keeps both models working.

create or replace function public.is_assigned_to_job(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.job_assignments ja
    join public.workers w on w.id = ja.worker_id
    where ja.job_id = target_job_id
      and w.auth_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.jobs j
    join public.workers w on w.id = j.assigned_to
    where j.id = target_job_id
      and w.auth_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.jobs j
    where j.id = target_job_id
      and j.assigned_to = auth.uid()
  );
$$;

drop policy if exists jobs_team_work_read on public.jobs;
create policy jobs_team_work_read on public.jobs
  for select using (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
    or assigned_to = auth.uid()
    or public.is_assigned_to_job(id)
    or public.record_shared_with_current_user(organization_id, 'job', id)
  );

drop policy if exists jobs_team_work_update on public.jobs;
create policy jobs_team_work_update on public.jobs
  for update
  using (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
    or assigned_to = auth.uid()
    or public.is_assigned_to_job(id)
    or exists (
      select 1 from public.record_shares rs
      where rs.organization_id = jobs.organization_id
        and rs.record_type = 'job'
        and rs.record_id = jobs.id
        and rs.shared_with_user_id = auth.uid()
        and rs.access_level = 'edit'
    )
  )
  with check (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
    or assigned_to = auth.uid()
    or public.is_assigned_to_job(id)
  );

notify pgrst, 'reload schema';
