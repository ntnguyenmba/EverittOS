#!/usr/bin/env node
/**
 * Diagnose / repair contractor worker identity against production.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... \
 *     npx tsx scripts/diagnose-contractor-identity.ts thuy@everittventures.com
 *
 *   DATABASE_URL=... npx tsx scripts/diagnose-contractor-identity.ts thuy@everittventures.com --repair
 */
import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';

const email = (process.argv[2] || 'thuy@everittventures.com').trim().toLowerCase();
const doRepair = process.argv.includes('--repair');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function viaPsql(): boolean {
  if (!dbUrl) return false;
  const escaped = email.replace(/'/g, "''");
  const sql = doRepair
    ? `select jsonb_pretty(public.repair_contractor_worker_identity('${escaped}'));`
    : `
select u.id as auth_user_id, u.email
from auth.users u
where lower(u.email) = '${escaped}';

select om.organization_id, om.role, om.active, o.name, o.deleted_at
from public.organization_members om
left join public.organizations o on o.id = om.organization_id
join auth.users u on u.id = om.user_id
where lower(u.email) = '${escaped}'
order by om.created_at;

select w.id, w.organization_id, w.email, w.auth_user_id, w.name, w.active,
  (select count(*) from public.jobs j where j.assigned_to = w.id) as assigned_jobs,
  (select count(*) from public.job_labor jl where jl.worker_id = w.id) as labor_rows,
  (select coalesce(sum(jl.total_cost),0) from public.job_labor jl where jl.worker_id = w.id) as labor_total
from public.workers w
where lower(coalesce(w.email,'')) = '${escaped}'
   or w.auth_user_id = (select id from auth.users where lower(email)='${escaped}' limit 1)
order by w.created_at;

select pg_get_functiondef('public.is_assigned_to_job(uuid)'::regprocedure) like '%w.id = j.assigned_to%' as rls_worker_bridge_present;

select jsonb_pretty(detail)
from public.data_repair_log
where repair_key = 'contractor_worker_identity:${escaped}'
order by created_at desc
limit 1;
`;
  const result = spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status || 1);
  return true;
}

async function viaRest() {
  if (!url || !serviceKey) fail('Missing SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL');

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let authUser: { id: string; email?: string } | null = null;
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(error.message);
    authUser = (data.users || []).find((row) => String(row.email || '').toLowerCase() === email) || null;
    if (authUser || !data.users?.length || data.users.length < 200) break;
  }

  if (!authUser) {
    console.log(JSON.stringify({ email, auth_user_id: null }, null, 2));
    return;
  }

  const authId = authUser.id;
  const [{ data: memberships }, { data: workersAuth }, { data: workersEmail }] = await Promise.all([
    admin
      .from('organization_members')
      .select('organization_id, role, active, created_at, organizations(id, name, deleted_at)')
      .eq('user_id', authId)
      .order('created_at', { ascending: true }),
    admin.from('workers').select('id, organization_id, email, auth_user_id, name, active, created_at').eq('auth_user_id', authId),
    admin.from('workers').select('id, organization_id, email, auth_user_id, name, active, created_at').ilike('email', email)
  ]);

  const workerMap = new Map<string, Record<string, unknown>>();
  for (const row of [...(workersAuth || []), ...(workersEmail || [])]) {
    workerMap.set(String(row.id), row as Record<string, unknown>);
  }
  const workers = Array.from(workerMap.values());
  const workerIds = workers.map((row) => String(row.id));

  const [jobsByWorker, jobsByAuth, assignments, labor, priorLog] = await Promise.all([
    workerIds.length
      ? admin.from('jobs').select('id, title, status, organization_id, assigned_to').in('assigned_to', workerIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    admin.from('jobs').select('id, title, status, organization_id, assigned_to').eq('assigned_to', authId),
    workerIds.length
      ? admin.from('job_assignments').select('id, job_id, worker_id').in('worker_id', workerIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    workerIds.length
      ? admin.from('job_labor').select('id, job_id, worker_id, total_cost, payment_status, organization_id').in('worker_id', workerIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    admin
      .from('data_repair_log')
      .select('id, repair_key, detail, created_at')
      .eq('repair_key', `contractor_worker_identity:${email}`)
      .order('created_at', { ascending: false })
      .limit(1)
  ]);

  let repairResult: unknown = null;
  if (doRepair) {
    const { data, error } = await admin.rpc('repair_contractor_worker_identity', { p_email: email });
    if (error) fail(`repair failed: ${error.message}`);
    repairResult = data;
  }

  const laborRows = labor.data || [];
  console.log(
    JSON.stringify(
      {
        email,
        auth_user_id: authId,
        auth_email: authUser.email,
        memberships,
        workers,
        jobs_on_workers: jobsByWorker.data || [],
        jobs_on_auth_uid: jobsByAuth.data || [],
        job_assignments: assignments.data || [],
        job_labor: laborRows,
        totals: {
          worker_count: workers.length,
          jobs_on_workers: (jobsByWorker.data || []).length,
          jobs_on_auth_uid: (jobsByAuth.data || []).length,
          assignments: (assignments.data || []).length,
          labor_rows: laborRows.length,
          labor_total: laborRows.reduce((sum, row) => sum + Number((row as { total_cost?: number }).total_cost || 0), 0)
        },
        prior_repair_log: priorLog.data?.[0] || null,
        repair_result: repairResult
      },
      null,
      2
    )
  );
}

if (dbUrl) {
  viaPsql();
} else {
  viaRest().catch((error) => fail(error instanceof Error ? error.message : String(error)));
}
