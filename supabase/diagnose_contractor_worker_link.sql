-- Diagnostic queries for contractor "not linked to a worker profile".
-- Run in Supabase SQL editor. Replace the email as needed.

-- 1) Auth user
select id as auth_user_id, email, created_at
from auth.users
where lower(email) = lower('thuy@everittventures.com');

-- 2) Profile
select id, role, organization_id, email, full_name, display_name
from public.profiles
where id = (select id from auth.users where lower(email) = lower('thuy@everittventures.com') limit 1)
   or lower(coalesce(email, '')) = lower('thuy@everittventures.com');

-- 3) Memberships
select om.organization_id, om.role, om.active, o.name, o.deleted_at
from public.organization_members om
left join public.organizations o on o.id = om.organization_id
where om.user_id = (select id from auth.users where lower(email) = lower('thuy@everittventures.com') limit 1);

-- 4) All worker rows that could belong to this person
select
  w.id,
  w.auth_user_id,
  w.email,
  w.name,
  w.organization_id,
  w.active,
  (select count(*) from public.jobs j where j.assigned_to = w.id) as assigned_jobs,
  (select count(*) from public.job_assignments ja where ja.worker_id = w.id) as assignments,
  (select count(*) from public.job_labor jl where jl.worker_id = w.id) as labor_rows,
  (select coalesce(sum(jl.total_cost), 0) from public.job_labor jl where jl.worker_id = w.id) as labor_total
from public.workers w
where w.auth_user_id = (select id from auth.users where lower(email) = lower('thuy@everittventures.com') limit 1)
   or lower(coalesce(w.email, '')) = lower('thuy@everittventures.com')
   or (
     w.organization_id in (
       select om.organization_id
       from public.organization_members om
       where om.user_id = (select id from auth.users where lower(email) = lower('thuy@everittventures.com') limit 1)
         and om.active = true
     )
     and lower(btrim(coalesce(w.name, ''))) = lower(btrim(coalesce(
       (select coalesce(full_name, display_name, '') from public.profiles
         where id = (select id from auth.users where lower(email) = lower('thuy@everittventures.com') limit 1)),
       ''
     )))
   )
order by w.created_at nulls last;

-- 5) Repair log (after applying 202609210001)
select repair_key, created_at, detail
from public.data_repair_log
where repair_key like 'contractor_worker%'
order by created_at desc
limit 20;
