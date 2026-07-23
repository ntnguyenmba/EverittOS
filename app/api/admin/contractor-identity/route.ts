import { NextResponse } from 'next/server';
import { isPlatformAdminEmail } from '@/lib/platform-admin';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_EMAIL = 'thuy@everittventures.com';

function normalizeEmail(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

async function requirePlatformAdmin() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user || !isPlatformAdminEmail(user.email)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  const admin = createAdminSupabase();
  if (!admin) {
    return { error: NextResponse.json({ error: 'Admin Supabase client unavailable' }, { status: 503 }) };
  }
  return { user, admin };
}

async function findAuthUserByEmail(admin: NonNullable<ReturnType<typeof createAdminSupabase>>, email: string) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const match = (data.users || []).find((row) => normalizeEmail(row.email) === email);
    if (match) return match;
    if (!data.users?.length || data.users.length < 200) return null;
    page += 1;
    if (page > 50) return null;
  }
}

async function diagnose(email: string, repair: boolean) {
  const gate = await requirePlatformAdmin();
  if ('error' in gate && gate.error) return gate.error;
  const { admin } = gate as { admin: NonNullable<ReturnType<typeof createAdminSupabase>> };

  const authUser = await findAuthUserByEmail(admin, email);
  if (!authUser) {
    return NextResponse.json({ email, auth_user_id: null, note: 'No auth.users row for this email' });
  }

  const authId = authUser.id;
  const [{ data: memberships, error: membershipError }, { data: workersAuth }, { data: workersEmail }] =
    await Promise.all([
      admin
        .from('organization_members')
        .select('organization_id, role, active, created_at, organizations(id, name, deleted_at, owner_user_id)')
        .eq('user_id', authId)
        .order('created_at', { ascending: true }),
      admin.from('workers').select('id, organization_id, email, auth_user_id, name, active, created_at').eq('auth_user_id', authId),
      admin.from('workers').select('id, organization_id, email, auth_user_id, name, active, created_at').ilike('email', email)
    ]);

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  const workerMap = new Map<string, Record<string, unknown>>();
  for (const row of [...(workersAuth || []), ...(workersEmail || [])]) {
    workerMap.set(String(row.id), row as Record<string, unknown>);
  }
  const workers = Array.from(workerMap.values());
  const workerIds = workers.map((row) => String(row.id));

  const [jobsByWorker, jobsByAuth, assignments, labor, priorLog] = await Promise.all([
    workerIds.length
      ? admin
          .from('jobs')
          .select('id, title, status, organization_id, assigned_to, created_at')
          .in('assigned_to', workerIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    admin.from('jobs').select('id, title, status, organization_id, assigned_to, created_at').eq('assigned_to', authId),
    workerIds.length
      ? admin.from('job_assignments').select('id, job_id, worker_id').in('worker_id', workerIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    workerIds.length
      ? admin
          .from('job_labor')
          .select('id, job_id, worker_id, total_cost, payment_status, organization_id')
          .in('worker_id', workerIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    admin
      .from('data_repair_log')
      .select('id, repair_key, detail, created_at')
      .eq('repair_key', `contractor_worker_identity:${email}`)
      .order('created_at', { ascending: false })
      .limit(1)
  ]);

  let repairResult: unknown = null;
  if (repair) {
    const { data, error } = await admin.rpc('repair_contractor_worker_identity', { p_email: email });
    if (error) {
      return NextResponse.json({ error: error.message, stage: 'repair' }, { status: 500 });
    }
    repairResult = data;
  }

  const laborRows = (labor.data || []) as Array<{ total_cost?: number | string | null; payment_status?: string | null; worker_id?: string }>;
  const jobsWorker = (jobsByWorker.data || []) as Array<{ assigned_to?: string }>;
  const historyByWorker = workerIds.map((id) => ({
    worker_id: id,
    jobs: jobsWorker.filter((job) => job.assigned_to === id).length,
    labor_rows: laborRows.filter((row) => row.worker_id === id).length,
    labor_total: laborRows
      .filter((row) => row.worker_id === id)
      .reduce((sum, row) => sum + Number(row.total_cost || 0), 0)
  }));

  return NextResponse.json({
    email,
    auth_user_id: authId,
    auth_email: authUser.email,
    memberships: memberships || [],
    workers,
    history_by_worker: historyByWorker,
    jobs_assigned_to_worker_ids: jobsByWorker.data || [],
    jobs_assigned_to_auth_uid: jobsByAuth.data || [],
    job_assignments: assignments.data || [],
    job_labor: labor.data || [],
    totals: {
      worker_count: workers.length,
      jobs_on_workers: (jobsByWorker.data || []).length,
      jobs_on_auth_uid: (jobsByAuth.data || []).length,
      assignments: (assignments.data || []).length,
      labor_rows: laborRows.length,
      labor_total: laborRows.reduce((sum, row) => sum + Number(row.total_cost || 0), 0)
    },
    prior_repair_log: priorLog.data?.[0] || null,
    repair_result: repairResult,
    notes: {
      likely_root_cause:
        'Login worker (auth_user_id) differs from historical jobs/labor worker.id for the same email/org.',
      migration: 'supabase/migrations/202609190001_contractor_worker_identity_repair.sql',
      apply_hint: 'Run migration in Supabase SQL editor, or POST this endpoint with repair=1 as platform admin.'
    }
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = normalizeEmail(searchParams.get('email') || DEFAULT_EMAIL);
  const repair = searchParams.get('repair') === '1';
  try {
    return await diagnose(email, repair);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Diagnosis failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string; repair?: boolean };
  const email = normalizeEmail(body.email || DEFAULT_EMAIL);
  try {
    return await diagnose(email, body.repair !== false);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Repair failed' },
      { status: 500 }
    );
  }
}
