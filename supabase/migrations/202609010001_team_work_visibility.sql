-- Role-aware team work visibility foundation.
-- Owners/admins/managers can see operational workspace work.
-- Workers/contractors can see work they created, work assigned to them, and records explicitly shared with them.

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

create or replace function public.record_shared_with_current_user(p_org_id uuid, p_record_type text, p_record_id uuid)
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
  )
$$;

drop policy if exists record_shares_read on public.record_shares;
create policy record_shares_read on public.record_shares for select
  using (
    public.can_manage_org_work(organization_id)
    or shared_with_user_id = auth.uid()
    or shared_by_user_id = auth.uid()
  );

drop policy if exists record_shares_manage on public.record_shares;
create policy record_shares_manage on public.record_shares for all
  using (public.can_manage_org_work(organization_id))
  with check (public.can_manage_org_work(organization_id));

alter table public.jobs add column if not exists assigned_to uuid references auth.users(id) on delete set null;
create index if not exists jobs_assigned_to_idx on public.jobs (organization_id, assigned_to);

-- Tighten job visibility to role-aware work access.
drop policy if exists jobs_org_access on public.jobs;
drop policy if exists jobs_org on public.jobs;
drop policy if exists jobs_read on public.jobs;
create policy jobs_team_work_read on public.jobs for select
  using (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
    or assigned_to = auth.uid()
    or public.record_shared_with_current_user(organization_id, 'job', id)
  );

drop policy if exists jobs_team_work_write on public.jobs;
create policy jobs_team_work_write on public.jobs for insert
  with check (public.can_manage_org_work(organization_id) or user_id = auth.uid());

drop policy if exists jobs_team_work_update on public.jobs;
create policy jobs_team_work_update on public.jobs for update
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
create policy jobs_team_work_delete on public.jobs for delete
  using (public.can_manage_org_work(organization_id));

-- Customers remain visible to managers and can be shared to staff/contractors when needed.
drop policy if exists customers_org_access on public.customers;
drop policy if exists customers_org on public.customers;
drop policy if exists customers_read on public.customers;
create policy customers_team_work_read on public.customers for select
  using (
    public.can_manage_org_work(organization_id)
    or user_id = auth.uid()
    or public.record_shared_with_current_user(organization_id, 'customer', id)
    or exists (
      select 1 from public.jobs j
      where j.customer_id = customers.id
        and j.organization_id = customers.organization_id
        and (j.assigned_to = auth.uid() or j.user_id = auth.uid() or public.record_shared_with_current_user(j.organization_id, 'job', j.id))
    )
  );

drop policy if exists customers_team_work_write on public.customers;
create policy customers_team_work_write on public.customers for insert
  with check (public.can_manage_org_work(organization_id) or user_id = auth.uid());

drop policy if exists customers_team_work_update on public.customers;
create policy customers_team_work_update on public.customers for update
  using (public.can_manage_org_work(organization_id) or user_id = auth.uid())
  with check (public.can_manage_org_work(organization_id) or user_id = auth.uid());

drop policy if exists customers_team_work_delete on public.customers;
create policy customers_team_work_delete on public.customers for delete
  using (public.can_manage_org_work(organization_id));
