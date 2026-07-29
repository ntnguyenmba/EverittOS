import { NextResponse } from 'next/server';
import { contractorCanAccessJob, contractorJobMode } from '@/lib/contractor-job-access';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

type WorkerRow = {
  id?: string | null;
};

const ALLOWED_STATUSES = new Set(['assigned', 'scheduled', 'in_progress', 'completed']);

export async function PATCH(request: Request, context: RouteContext) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const { id: jobId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .maybeSingle();

  const email = String(user.email || profile?.email || '').trim().toLowerCase();
  const [authWorkersResult, emailWorkersResult, jobResult, assignmentsResult, sharesResult] = await Promise.all([
    supabase.from('workers').select('id').eq('auth_user_id', user.id),
    email ? supabase.from('workers').select('id').ilike('email', email) : Promise.resolve({ data: [] as WorkerRow[] }),
    supabase.from('jobs').select('id, status, assigned_to').eq('id', jobId).maybeSingle(),
    supabase.from('job_assignments').select('job_id, worker_id').eq('job_id', jobId),
    supabase
      .from('record_shares')
      .select('record_id, shared_with_user_id, access_level')
      .eq('record_type', 'job')
      .eq('record_id', jobId)
      .eq('shared_with_user_id', user.id)
  ]);

  const job = jobResult.data;
  if (!job) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }

  const workerIds = Array.from(
    new Set(
      [...(authWorkersResult.data || []), ...(emailWorkersResult.data || [])]
        .map((worker) => String(worker.id || '').trim())
        .filter(Boolean)
    )
  );

  const allowed = contractorCanAccessJob({
    job,
    workerIds,
    userId: user.id,
    assignments: assignmentsResult.data || [],
    shares: sharesResult.data || []
  });

  if (!allowed) {
    return NextResponse.json({ error: 'You do not have access to this job.' }, { status: 403 });
  }

  if (contractorJobMode(job.status) !== 'active') {
    return NextResponse.json({ error: 'Completed and cancelled jobs are view-only.' }, { status: 409 });
  }

  const payload: Record<string, unknown> = {};

  if (typeof body.status === 'string') {
    const status = body.status.trim().toLowerCase().replace(/\s+/g, '_');
    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: 'This status is not available to contractors.' }, { status: 400 });
    }
    payload.status = status;
    if (status === 'completed') payload.completed_at = new Date().toISOString();
  }

  if (typeof body.notes === 'string') {
    payload.notes = body.notes.trim().slice(0, 5000) || null;
  }

  if (!Object.keys(payload).length) {
    return NextResponse.json({ error: 'No valid job updates were provided.' }, { status: 400 });
  }

  const { error } = await supabase.from('jobs').update(payload).eq('id', jobId);
  if (error) {
    return NextResponse.json({ error: error.message || 'Unable to update this job.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
