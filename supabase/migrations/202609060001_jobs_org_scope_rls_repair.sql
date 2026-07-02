-- Repair job organization scoping and consolidate jobs RLS for consistent org-wide visibility.

-- Backfill organization_id on legacy jobs from creator profile or active membership.
update public.jobs j
set organization_id = p.organization_id
from public.profiles p
where j.organization_id is null
  and j.user_id = p.id
  and p.organization_id is not null;

update public.jobs j
set organization_id = om.organization_id
from public.organization_members om
where j.organization_id is null
  and j.user_id = om.user_id
  and om.active = true;

-- Owners without an organization_members row should still manage org work.
create or replace function public.can_manage_org_work(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_org_role(p_org_id) in ('owner', 'admin', 'manager'), false)
    or exists (
      select 1
      from public.organizations o
      where o.id = p_org_id
        and o.owner_user_id = auth.uid()
    )
$$;

-- Remove legacy overlapping policies that predate team work visibility.
drop policy if exists jobs_own on public.jobs;
drop policy if exists jobs_select_role on public.jobs;
drop policy if exists jobs_update_role on public.jobs;
drop policy if exists jobs_insert_role on public.jobs;
drop policy if exists jobs_delete_role on public.jobs;
drop policy if exists jobs_org_select on public.jobs;
drop policy if exists jobs_org_write on public.jobs;
drop policy if exists jobs_org_access on public.jobs;
drop policy if exists jobs_org on public.jobs;
drop policy if exists jobs_read on public.jobs;

drop policy if exists jobs_team_work_read on public.jobs;
create policy jobs_team_work_read on public.jobs
  for select using (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
    or assigned_to = auth.uid()
    or public.record_shared_with_current_user(organization_id, 'job', id)
  );

drop policy if exists jobs_team_work_write on public.jobs;
create policy jobs_team_work_write on public.jobs
  for insert
  with check (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
  );

drop policy if exists jobs_team_work_update on public.jobs;
create policy jobs_team_work_update on public.jobs
  for update
  using (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
    or assigned_to = auth.uid()
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
  );

drop policy if exists jobs_team_work_delete on public.jobs;
create policy jobs_team_work_delete on public.jobs
  for delete
  using (public.can_manage_org_work(organization_id));
