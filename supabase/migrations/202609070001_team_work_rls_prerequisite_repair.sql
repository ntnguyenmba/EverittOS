-- Team work RLS prerequisite repair.
-- Production may have skipped 202609010001 while later migrations reference
-- can_manage_org_work() and record_shared_with_current_user().
-- This migration is idempotent and uses helpers that already exist in production:
--   member_role_in_org, can_manage_organization, is_assigned_to_job.

-- ---------------------------------------------------------------------------
-- Shared objects (from 202609010001)
-- ---------------------------------------------------------------------------

create table if not exists public.record_shares (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  record_type text not null check (record_type in ('job', 'customer', 'photo', 'report', 'note', 'document')),
  record_id uuid not null,
  shared_with_user_id uuid not null references auth.users(id) on delete cascade,
  shared_by_user_id uuid references auth.users(id) on delete set null,
  access_level text not null default 'view' check (access_level in ('view', 'edit')),
  created_at timestamptz not null default now(),
  unique (organization_id, record_type, record_id, shared_with_user_id)
);

create index if not exists record_shares_org_record_idx on public.record_shares (organization_id, record_type, record_id);
create index if not exists record_shares_user_idx on public.record_shares (shared_with_user_id, organization_id);

alter table public.record_shares enable row level security;

alter table public.jobs add column if not exists assigned_to uuid references auth.users(id) on delete set null;
create index if not exists jobs_assigned_to_idx on public.jobs (organization_id, assigned_to);

-- Alias for migrations/policies that reference current_org_role; backed by member_role_in_org.
create or replace function public.current_org_role(p_org_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.member_role_in_org(p_org_id);
$$;

create or replace function public.record_shared_with_current_user(
  p_org_id uuid,
  p_record_type text,
  p_record_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.record_shares rs
    where rs.organization_id = p_org_id
      and rs.record_type = p_record_type
      and rs.record_id = p_record_id
      and rs.shared_with_user_id = auth.uid()
  );
$$;

-- Owner/admin/manager work management. Uses can_manage_organization (production-safe)
-- plus organizations.owner_user_id for owners missing an organization_members row.
create or replace function public.can_manage_org_work(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    p_org_id is not null
    and (
      coalesce(public.can_manage_organization(p_org_id), false)
      or exists (
        select 1
        from public.organizations o
        where o.id = p_org_id
          and o.owner_user_id = auth.uid()
      )
    )
  );
$$;

drop policy if exists record_shares_read on public.record_shares;
create policy record_shares_read on public.record_shares
  for select using (
    public.can_manage_org_work(organization_id)
    or shared_with_user_id = auth.uid()
    or shared_by_user_id = auth.uid()
  );

drop policy if exists record_shares_manage on public.record_shares;
create policy record_shares_manage on public.record_shares
  for all using (public.can_manage_org_work(organization_id))
  with check (public.can_manage_org_work(organization_id));

-- ---------------------------------------------------------------------------
-- Backfill organization_id on legacy jobs
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Jobs RLS (consolidated team work policies)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- job_photos / job_reports RLS
-- ---------------------------------------------------------------------------

drop policy if exists job_photos_select_role on public.job_photos;
drop policy if exists job_photos_own on public.job_photos;
drop policy if exists job_photos_team_work_read on public.job_photos;
drop policy if exists job_photos_team_work_write on public.job_photos;
drop policy if exists job_reports_org on public.job_reports;
drop policy if exists job_reports_owner_all on public.job_reports;
drop policy if exists job_reports_team_work_read on public.job_reports;
drop policy if exists job_reports_team_work_write on public.job_reports;

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

notify pgrst, 'reload schema';
