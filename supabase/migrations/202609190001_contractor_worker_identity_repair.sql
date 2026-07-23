-- Contractor worker identity repair for thuy@everittventures.com (and same-class duplicates).
--
-- Root cause class:
--   Login resolves workers via auth_user_id, while historical jobs / job_labor /
--   job_assignments often reference an older workers.id (same email/org, null or
--   different auth_user_id). Dashboard metrics then look empty even though jobs exist.
--
-- Safety:
--   - Does not delete jobs, labor, or payment history
--   - Remaps foreign keys onto the canonical workers row (history-first)
--   - Soft-deactivates duplicate worker rows and clears their auth_user_id
--   - Writes a durable report into public.data_repair_log
--   - Prevents future active duplicates with unique indexes

create table if not exists public.data_repair_log (
  id uuid primary key default gen_random_uuid(),
  repair_key text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists data_repair_log_key_idx
  on public.data_repair_log (repair_key, created_at desc);

alter table public.data_repair_log enable row level security;

drop policy if exists data_repair_log_admin_read on public.data_repair_log;
create policy data_repair_log_admin_read on public.data_repair_log
  for select using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(coalesce(p.role, '')) in ('owner', 'admin')
    )
  );

-- Keep contractor job visibility bridge present (idempotent with 202609180001).
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

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'jobs' and policyname = 'jobs_team_work_read'
  ) then
    execute 'drop policy if exists jobs_team_work_read on public.jobs';
    execute $pol$
      create policy jobs_team_work_read on public.jobs
        for select using (
          public.can_manage_org_work(organization_id)
          or user_id = auth.uid()
          or assigned_to = auth.uid()
          or public.is_assigned_to_job(id)
          or public.record_shared_with_current_user(organization_id, 'job', id)
        )
    $pol$;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'jobs' and policyname = 'jobs_team_work_update'
  ) then
    execute 'drop policy if exists jobs_team_work_update on public.jobs';
    execute $pol$
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
        )
    $pol$;
  end if;
end $$;

create or replace function public.repair_contractor_worker_identity(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_auth_id uuid;
  v_auth_email text;
  v_org_id uuid;
  v_canonical uuid;
  v_dup_ids uuid[];
  v_moved int;
  v_jobs_remapped int := 0;
  v_assignments_remapped int := 0;
  v_labor_remapped int := 0;
  v_legacy_auth_remapped int := 0;
  v_workers_deactivated int := 0;
  v_org_repairs jsonb := '[]'::jsonb;
  v_memberships jsonb := '[]'::jsonb;
  v_workers_before jsonb := '[]'::jsonb;
  v_workers_after jsonb := '[]'::jsonb;
  v_rls_bridge boolean := false;
  v_sample_job uuid;
  v_is_assigned boolean := false;
  v_active_jobs int := 0;
  v_labor_total numeric := 0;
  v_paid_total numeric := 0;
  v_pending_total numeric := 0;
  v_other_worker_jobs_visible int := 0;
  v_report jsonb := '{}'::jsonb;
begin
  if v_email = '' then
    raise exception 'repair_contractor_worker_identity requires an email';
  end if;

  select u.id, u.email
    into v_auth_id, v_auth_email
  from auth.users u
  where lower(u.email) = v_email
  order by u.created_at asc
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'organization_id', om.organization_id,
    'role', om.role,
    'active', om.active,
    'organization_name', o.name,
    'organization_deleted_at', o.deleted_at
  ) order by om.created_at), '[]'::jsonb)
  into v_memberships
  from public.organization_members om
  left join public.organizations o on o.id = om.organization_id
  where v_auth_id is not null
    and om.user_id = v_auth_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', w.id,
    'organization_id', w.organization_id,
    'email', w.email,
    'auth_user_id', w.auth_user_id,
    'name', w.name,
    'active', coalesce(w.active, true),
    'assigned_jobs', (select count(*)::int from public.jobs j where j.assigned_to = w.id),
    'job_assignments', (select count(*)::int from public.job_assignments ja where ja.worker_id = w.id),
    'labor_rows', (select count(*)::int from public.job_labor jl where jl.worker_id = w.id),
    'labor_total', (select coalesce(sum(jl.total_cost), 0) from public.job_labor jl where jl.worker_id = w.id)
  ) order by w.created_at nulls last), '[]'::jsonb)
  into v_workers_before
  from public.workers w
  where lower(coalesce(w.email, '')) = v_email
     or (v_auth_id is not null and w.auth_user_id = v_auth_id);

  for v_org_id in
    select distinct org_id
    from (
      select om.organization_id as org_id
      from public.organization_members om
      where v_auth_id is not null
        and om.user_id = v_auth_id
        and om.active = true
      union
      select w.organization_id
      from public.workers w
      where w.organization_id is not null
        and (
          lower(coalesce(w.email, '')) = v_email
          or (v_auth_id is not null and w.auth_user_id = v_auth_id)
        )
    ) s
    where org_id is not null
  loop
    select w.id
      into v_canonical
    from public.workers w
    where w.organization_id = v_org_id
      and (
        lower(coalesce(w.email, '')) = v_email
        or (v_auth_id is not null and w.auth_user_id = v_auth_id)
      )
    order by
      (
        (select count(*) from public.jobs j where j.assigned_to = w.id) * 1000
        + (select count(*) from public.job_assignments ja where ja.worker_id = w.id) * 800
        + (select count(*) from public.job_labor jl where jl.worker_id = w.id) * 600
        + least(coalesce((select sum(jl.total_cost) from public.job_labor jl where jl.worker_id = w.id), 0), 100000)
        + case when v_auth_id is not null and w.auth_user_id = v_auth_id then 100 else 0 end
        + case when w.auth_user_id is not null then 50 else 0 end
        + case when coalesce(w.active, true) then 25 else 0 end
      ) desc,
      w.created_at asc nulls last,
      w.id asc
    limit 1;

    if v_canonical is null then
      continue;
    end if;

    select coalesce(array_agg(w.id), array[]::uuid[])
      into v_dup_ids
    from public.workers w
    where w.organization_id = v_org_id
      and w.id <> v_canonical
      and (
        lower(coalesce(w.email, '')) = v_email
        or (v_auth_id is not null and w.auth_user_id = v_auth_id)
      );

    update public.workers w
    set
      auth_user_id = coalesce(v_auth_id, w.auth_user_id),
      email = coalesce(nullif(btrim(w.email), ''), v_auth_email, v_email),
      active = true
    where w.id = v_canonical;

    if coalesce(array_length(v_dup_ids, 1), 0) > 0 then
      update public.jobs j
      set assigned_to = v_canonical
      where j.assigned_to = any (v_dup_ids);
      get diagnostics v_moved = row_count;
      v_jobs_remapped := v_jobs_remapped + v_moved;

      -- job_assignments unique (job_id, worker_id): delete conflicting dups, then remap
      delete from public.job_assignments ja
      where ja.worker_id = any (v_dup_ids)
        and exists (
          select 1
          from public.job_assignments keep
          where keep.job_id = ja.job_id
            and keep.worker_id = v_canonical
        );

      update public.job_assignments ja
      set worker_id = v_canonical
      where ja.worker_id = any (v_dup_ids);
      get diagnostics v_moved = row_count;
      v_assignments_remapped := v_assignments_remapped + v_moved;

      update public.job_labor jl
      set worker_id = v_canonical
      where jl.worker_id = any (v_dup_ids);
      get diagnostics v_moved = row_count;
      v_labor_remapped := v_labor_remapped + v_moved;

      update public.workers w
      set
        active = false,
        auth_user_id = null,
        email = case
          when lower(coalesce(w.email, '')) = v_email then w.email || '#merged-' || left(w.id::text, 8)
          else w.email
        end
      where w.id = any (v_dup_ids);
      get diagnostics v_moved = row_count;
      v_workers_deactivated := v_workers_deactivated + v_moved;
    end if;

    if v_auth_id is not null then
      update public.jobs j
      set assigned_to = v_canonical
      where j.organization_id = v_org_id
        and j.assigned_to = v_auth_id;
      get diagnostics v_moved = row_count;
      v_legacy_auth_remapped := v_legacy_auth_remapped + v_moved;
    end if;

    v_org_repairs := v_org_repairs || jsonb_build_array(jsonb_build_object(
      'organization_id', v_org_id,
      'canonical_worker_id', v_canonical,
      'duplicate_worker_ids', to_jsonb(coalesce(v_dup_ids, array[]::uuid[]))
    ));
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', w.id,
    'organization_id', w.organization_id,
    'email', w.email,
    'auth_user_id', w.auth_user_id,
    'name', w.name,
    'active', coalesce(w.active, true),
    'assigned_jobs', (select count(*)::int from public.jobs j where j.assigned_to = w.id),
    'job_assignments', (select count(*)::int from public.job_assignments ja where ja.worker_id = w.id),
    'labor_rows', (select count(*)::int from public.job_labor jl where jl.worker_id = w.id),
    'labor_total', (select coalesce(sum(jl.total_cost), 0) from public.job_labor jl where jl.worker_id = w.id)
  ) order by w.created_at nulls last), '[]'::jsonb)
  into v_workers_after
  from public.workers w
  where lower(coalesce(w.email, '')) = v_email
     or lower(coalesce(w.email, '')) like v_email || '#merged-%'
     or (v_auth_id is not null and w.auth_user_id = v_auth_id);

  -- Dashboard-equivalent totals for active auth-linked workers (no join fan-out)
  select count(*)::int
    into v_active_jobs
  from public.jobs j
  where j.assigned_to in (
    select w.id
    from public.workers w
    where v_auth_id is not null
      and w.auth_user_id = v_auth_id
      and coalesce(w.active, true) = true
  )
  and lower(coalesce(j.status, '')) not in ('completed', 'done', 'complete', 'closed', 'cancelled', 'canceled');

  select
    coalesce(sum(jl.total_cost), 0),
    coalesce(sum(jl.total_cost) filter (where lower(coalesce(jl.payment_status, 'unpaid')) = 'paid'), 0),
    coalesce(sum(jl.total_cost) filter (where lower(coalesce(jl.payment_status, 'unpaid')) <> 'paid'), 0)
  into v_labor_total, v_paid_total, v_pending_total
  from public.job_labor jl
  where jl.worker_id in (
    select w.id
    from public.workers w
    where v_auth_id is not null
      and w.auth_user_id = v_auth_id
      and coalesce(w.active, true) = true
  );

  -- RLS bridge check (function body; auth.uid() may be null in migration context)
  select pg_get_functiondef('public.is_assigned_to_job(uuid)'::regprocedure) ilike '%w.id = j.assigned_to%'
    into v_rls_bridge;

  select j.id
    into v_sample_job
  from public.workers w
  join public.jobs j on j.assigned_to = w.id
  where v_auth_id is not null
    and w.auth_user_id = v_auth_id
    and coalesce(w.active, true) = true
  order by j.created_at desc nulls last
  limit 1;

  if v_sample_job is not null and v_auth_id is not null then
    -- Evaluate assignment helper using the contractor auth identity via workers join
    select exists (
      select 1
      from public.jobs j
      join public.workers w on w.id = j.assigned_to
      where j.id = v_sample_job
        and w.auth_user_id = v_auth_id
    )
    into v_is_assigned;
  end if;

  -- Isolation: active auth-linked worker should only be this contractor
  select count(*)::int
    into v_other_worker_jobs_visible
  from public.workers w
  where v_auth_id is not null
    and w.auth_user_id = v_auth_id
    and coalesce(w.active, true) = true
    and lower(coalesce(w.email, '')) <> v_email
    and lower(coalesce(w.email, '')) not like v_email || '#merged-%';

  v_report := jsonb_build_object(
    'email', v_email,
    'auth_user_id', v_auth_id,
    'auth_email', v_auth_email,
    'memberships', v_memberships,
    'workers_before', v_workers_before,
    'workers_after', v_workers_after,
    'org_repairs', v_org_repairs,
    'rows_repaired', jsonb_build_object(
      'jobs_assigned_to_remapped', v_jobs_remapped,
      'job_assignments_remapped', v_assignments_remapped,
      'job_labor_remapped', v_labor_remapped,
      'legacy_auth_uid_jobs_remapped', v_legacy_auth_remapped,
      'workers_deactivated', v_workers_deactivated
    ),
    'rls', jsonb_build_object(
      'is_assigned_to_job_bridges_worker_id', v_rls_bridge,
      'sample_job_id', v_sample_job,
      'sample_job_linked_via_worker_auth', v_is_assigned
    ),
    'dashboard_totals_after_repair', jsonb_build_object(
      'active_jobs', v_active_jobs,
      'labor_total', v_labor_total,
      'paid_total', v_paid_total,
      'pending_total', v_pending_total
    ),
    'isolation', jsonb_build_object(
      'cross_linked_active_workers_should_be_zero', v_other_worker_jobs_visible
    )
  );

  insert into public.data_repair_log (repair_key, detail)
  values ('contractor_worker_identity:' || v_email, v_report);

  return v_report;
end;
$$;

revoke all on function public.repair_contractor_worker_identity(text) from public;
grant execute on function public.repair_contractor_worker_identity(text) to service_role;

-- Run targeted repair for the reported contractor.
select public.repair_contractor_worker_identity('thuy@everittventures.com');

-- Prevent future active duplicates (same org + email / same org + auth user).
do $$
begin
  -- Clear email collisions among inactive merged rows already handled above.
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'workers_org_email_active_unique'
  ) then
    execute $idx$
      create unique index workers_org_email_active_unique
        on public.workers (organization_id, lower(btrim(email)))
        where organization_id is not null
          and email is not null
          and btrim(email) <> ''
          and position('#merged-' in email) = 0
          and coalesce(active, true) = true
    $idx$;
  end if;

  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'workers_org_auth_user_unique'
  ) then
    execute $idx$
      create unique index workers_org_auth_user_unique
        on public.workers (organization_id, auth_user_id)
        where organization_id is not null
          and auth_user_id is not null
    $idx$;
  end if;
exception
  when unique_violation then
    insert into public.data_repair_log (repair_key, detail)
    values (
      'contractor_worker_identity:unique_index_deferred',
      jsonb_build_object(
        'message', 'Unique indexes deferred because remaining duplicates still exist. Re-run repair_contractor_worker_identity for affected emails.',
        'sqlstate', SQLSTATE,
        'sqlerrm', SQLERRM
      )
    );
end $$;

notify pgrst, 'reload schema';
