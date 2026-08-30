import { NextResponse } from 'next/server';
import { loadContractorPortalJob } from '@/lib/portal-contractor-jobs';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id: jobId } = await context.params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loaded = await loadContractorPortalJob({
    supabase,
    userId: user.id,
    email: user.email,
    jobId
  });

  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  if (loaded.job.mode === 'cancelled') {
    return NextResponse.json({ error: 'Cancelled jobs cannot be updated.' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { status?: string };
  const requested = String(body.status || '').trim().toLowerCase();
  if (requested !== 'active' && requested !== 'completed') {
    return NextResponse.json({ error: 'Status must be active or completed.' }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Unable to update this job right now.' }, { status: 500 });
  }

  const payload: Record<string, unknown> = { status: requested };
  if (requested === 'completed') payload.completed_at = new Date().toISOString();

  const { data: updated, error } = await admin
    .from('jobs')
    .update(payload)
    .eq('id', jobId)
    .select('id, status, completed_at')
    .maybeSingle();

  if (error || !updated) {
    return NextResponse.json({ error: error?.message || 'Job could not be updated.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, job: updated });
}
