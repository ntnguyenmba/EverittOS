-- =============================================================================
-- EverittOS schema diagnostic (run FIRST when bootstrap fails)
-- Copy the full result and share it for troubleshooting.
-- =============================================================================

select '=== TABLES ===' as section;
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

select '=== COLUMNS (legacy + core) ===' as section;
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'profiles', 'business_profiles', 'companies', 'customers', 'jobs', 'workers',
    'technicians', 'job_photos', 'invoices', 'activity_events', 'ai_generations',
    'organizations', 'organization_members', 'everittos_subscriptions', 'job_reports',
    'activity_logs'
  )
order by table_name, ordinal_position;

select '=== MISSING user_id (needs bootstrap Phase A) ===' as section;
select t.table_name
from information_schema.tables t
where t.table_schema = 'public'
  and t.table_name in ('customers', 'jobs', 'workers', 'job_photos', 'invoices')
  and not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = t.table_name
      and c.column_name = 'user_id'
  );

select '=== OWNER-LIKE COLUMNS (legacy mapping candidates) ===' as section;
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('customers', 'jobs', 'workers', 'job_photos', 'companies', 'invoices')
  and (
    column_name like '%user%'
    or column_name like '%owner%'
    or column_name like '%profile%'
    or column_name like '%company%'
    or column_name like '%account%'
    or column_name like '%created%'
  )
order by table_name, column_name;

select '=== EXISTING POLICIES ===' as section;
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select '=== DONE ===' as section;
