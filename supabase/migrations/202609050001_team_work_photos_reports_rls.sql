-- Align job_photos and job_reports RLS with jobs team work visibility.
-- Prerequisites inlined for production databases that skipped 202609010001.

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
