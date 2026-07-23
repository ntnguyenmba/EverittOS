-- Relink existing contractor workers to auth.users without creating new workers.
--
-- Root cause of portal "not linked to a worker profile":
--   Historical workers often have auth_user_id NULL and/or blank email, while
--   jobs.assigned_to / job_labor.worker_id still reference that workers.id.
--   The portal looks up workers by auth_user_id + email, so it returns empty
--   and never reaches jobs/earnings queries.
--
-- This migration:
--   1) Backfills workers.organization_id from assigned jobs when missing
--   2) Relinks workers.auth_user_id (+ email) for members matched by email
--   3) Relinks unique name matches inside a shared organization
--   4) Re-runs repair_contractor_worker_identity for known contractor emails
--   5) Tightens workers SELECT so a linked auth user can always read their row
--
-- Does NOT insert workers. Does NOT delete jobs/payments.

create table if not exists public.data_repair_log (
  id uuid primary key default gen_random_uuid(),
  repair_key text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 1) Backfill organization_id onto workers from jobs they own
update public.workers w
set organization_id = j.organization_id
from (
  select assigned_to as worker_id, min(organization_id::text)::uuid as organization_id
  from public.jobs
  where assigned_to is not null
    and organization_id is not null
  group by assigned_to
) j
where w.id = j.worker_id
  and w.organization_id is null
  and j.organization_id is not null;

update public.workers w
set organization_id = ja.organization_id
from (
  select worker_id, min(organization_id::text)::uuid as organization_id
  from public.job_assignments
  where worker_id is not null
    and organization_id is not null
  group by worker_id
) ja
where w.id = ja.worker_id
  and w.organization_id is null
  and ja.organization_id is not null;

-- 2) Relink by email within shared org membership (auth_user_id null or already same user)
with candidates as (
  select
    w.id as worker_id,
    u.id as auth_user_id,
    lower(u.email) as auth_email,
    om.organization_id,
    (
      (select count(*) from public.jobs j where j.assigned_to = w.id)
      + (select count(*) from public.job_assignments a where a.worker_id = w.id)
      + (select count(*) from public.job_labor l where l.worker_id = w.id)
    ) as history_score
  from public.workers w
  join public.organization_members om
    on om.organization_id = w.organization_id
   and om.active = true
  join auth.users u
    on u.id = om.user_id
  where w.organization_id is not null
    and lower(btrim(coalesce(w.email, ''))) = lower(u.email)
    and (w.auth_user_id is null or w.auth_user_id = u.id)
),
ranked as (
  select
    c.*,
    row_number() over (
      partition by c.auth_user_id, c.organization_id
      order by c.history_score desc, c.worker_id asc
    ) as rn
  from candidates c
)
update public.workers w
set
  auth_user_id = r.auth_user_id,
  email = coalesce(nullif(btrim(w.email), ''), r.auth_email),
  active = true
from ranked r
where w.id = r.worker_id
  and r.rn = 1;

insert into public.data_repair_log (repair_key, detail)
select
  'contractor_worker_auth_relink:email',
  jsonb_build_object(
    'relinked_workers',
    coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'worker_id', w.id,
          'auth_user_id', w.auth_user_id,
          'email', w.email,
          'organization_id', w.organization_id
        ))
        from public.workers w
        where w.auth_user_id is not null
          and lower(coalesce(w.email, '')) = lower((
            select u.email from auth.users u where u.id = w.auth_user_id
          ))
      ),
      '[]'::jsonb
    )
  );

-- 3) Unique name match inside org for contractor/employee members still unlinked
with named as (
  select
    w.id as worker_id,
    u.id as auth_user_id,
    lower(u.email) as auth_email,
    om.organization_id,
    lower(btrim(coalesce(p.full_name, p.display_name, ''))) as profile_name,
    lower(btrim(coalesce(w.name, ''))) as worker_name,
    (
      (select count(*) from public.jobs j where j.assigned_to = w.id)
      + (select count(*) from public.job_labor l where l.worker_id = w.id)
    ) as history_score
  from public.workers w
  join public.organization_members om
    on om.organization_id = w.organization_id
   and om.active = true
   and lower(coalesce(om.role, '')) in ('contractor', 'employee', 'staff', 'crew_lead')
  join auth.users u on u.id = om.user_id
  left join public.profiles p on p.id = u.id
  where w.organization_id is not null
    and w.auth_user_id is null
    and lower(btrim(coalesce(w.name, ''))) <> ''
    and lower(btrim(coalesce(p.full_name, p.display_name, ''))) <> ''
    and lower(btrim(w.name)) = lower(btrim(coalesce(p.full_name, p.display_name, '')))
),
unique_names as (
  select
    organization_id,
    profile_name,
    count(*) as worker_matches
  from named
  group by organization_id, profile_name
  having count(*) = 1
),
picked as (
  select n.*
  from named n
  join unique_names u
    on u.organization_id = n.organization_id
   and u.profile_name = n.profile_name
)
update public.workers w
set
  auth_user_id = p.auth_user_id,
  email = coalesce(nullif(btrim(w.email), ''), p.auth_email),
  active = true
from picked p
where w.id = p.worker_id
  and w.auth_user_id is null;

-- 4) Ensure linked auth users can always SELECT their worker row (even if org_id was null historically)
drop policy if exists workers_self_auth_select on public.workers;
create policy workers_self_auth_select on public.workers
  for select using (
    auth.uid() = auth_user_id
    or (
      auth.uid() is not null
      and email is not null
      and lower(btrim(email)) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- 5) Re-run identity consolidation for the reported contractor + any contractor emails still split
do $$
declare
  r record;
  result jsonb;
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'repair_contractor_worker_identity'
  ) then
    for r in
      select distinct lower(u.email) as email
      from auth.users u
      where lower(u.email) in (
        'thuy@everittventures.com'
      )
      or exists (
        select 1
        from public.organization_members om
        where om.user_id = u.id
          and om.active = true
          and lower(coalesce(om.role, '')) = 'contractor'
      )
    loop
      begin
        result := public.repair_contractor_worker_identity(r.email);
        insert into public.data_repair_log (repair_key, detail)
        values ('contractor_worker_auth_relink:run:' || r.email, coalesce(result, '{}'::jsonb));
      exception
        when others then
          insert into public.data_repair_log (repair_key, detail)
          values (
            'contractor_worker_auth_relink:error:' || r.email,
            jsonb_build_object('sqlstate', SQLSTATE, 'sqlerrm', SQLERRM)
          );
      end;
    end loop;
  end if;
end $$;

notify pgrst, 'reload schema';
