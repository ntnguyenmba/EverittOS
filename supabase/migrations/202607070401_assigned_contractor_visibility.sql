-- Assigned contractor visibility helpers.
-- This keeps owner/admin/manager broad access while letting contractors see work assigned through linked worker records.

create or replace function public.is_assigned_to_job(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.jobs j
    where j.id = target_job_id
      and j.assigned_to = auth.uid()
  ) or exists (
    select 1
    from public.jobs j
    join public.workers w on w.id = j.assigned_to
    where j.id = target_job_id
      and w.auth_user_id = auth.uid()
  ) or exists (
    select 1
    from public.job_assignments ja
    join public.workers w on w.id = ja.worker_id
    where ja.job_id = target_job_id
      and w.auth_user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_org_work(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_org_id is not null
    and (
      public.member_role_in_org(p_org_id) in ('owner', 'admin', 'manager')
      or exists (
        select 1
        from public.organizations o
        where o.id = p_org_id
          and o.owner_user_id = auth.uid()
      )
    );
$$;

create or replace function public.is_assigned_to_customer(target_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customers c
    where c.id = target_customer_id
      and c.assigned_to = auth.uid()
  ) or exists (
    select 1
    from public.jobs j
    where j.customer_id = target_customer_id
      and public.is_assigned_to_job(j.id)
  );
$$;

notify pgrst, 'reload schema';
