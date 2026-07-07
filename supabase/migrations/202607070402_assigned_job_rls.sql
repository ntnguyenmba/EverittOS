-- Assigned job RLS policies.

alter table public.jobs enable row level security;

drop policy if exists jobs_team_work_read on public.jobs;
create policy jobs_team_work_read on public.jobs
  for select using (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
    or public.is_assigned_to_job(id)
    or public.record_shared_with_current_user(organization_id, 'job', id)
  );

drop policy if exists jobs_team_work_write on public.jobs;
create policy jobs_team_work_write on public.jobs
  for insert with check (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
  );

notify pgrst, 'reload schema';
