import { NextResponse } from 'next/server';
import { isValidUuid } from '@/lib/input-validation';
import { isCompletedLikeStatus } from '@/lib/recurring-jobs';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }
  const { id } = await context.params;
  if (!isValidUuid(id)) return NextResponse.json({ error: 'Invalid series id.' }, { status: 400 });

  const { data: series, error } = await ctx.supabase
    .from('recurring_job_series')
    .select('*')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (error) {
    if (isMissingSchemaError(error)) {
      return NextResponse.json({ error: 'Recurring jobs migration is not applied yet.' }, { status: 503 });
    }
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }
  if (!series) return NextResponse.json({ error: 'Series not found.' }, { status: 404 });

  const { data: jobs } = await ctx.supabase
    .from('jobs')
    .select('id, title, status, occurrence_date, scheduled_start, revenue_amount, is_skipped, assigned_to')
    .eq('recurring_series_id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .order('occurrence_date', { ascending: true });

  return NextResponse.json({ series, jobs: jobs || [] });
}

export async function PATCH(request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }
  const { id } = await context.params;
  if (!isValidUuid(id)) return NextResponse.json({ error: 'Invalid series id.' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as {
    action?: 'pause' | 'resume' | 'end' | 'edit_series' | 'edit_future';
    fromDate?: string;
    endDate?: string | null;
    title?: string;
    notes?: string | null;
    default_price?: number | null;
    preferred_start_time?: string | null;
    duration_minutes?: number | null;
    timezone?: string | null;
    cancelFutureJobs?: boolean;
  };

  const { data: series, error } = await ctx.supabase
    .from('recurring_job_series')
    .select('*')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (error || !series) {
    return NextResponse.json({ error: error ? mapWorkspaceSaveError(error.message) : 'Series not found.' }, { status: error ? 400 : 404 });
  }

  const action = body.action || 'edit_series';

  if (action === 'pause') {
    await ctx.supabase
      .from('recurring_job_series')
      .update({ status: 'paused', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (body.cancelFutureJobs) {
      const today = new Date().toISOString().slice(0, 10);
      await ctx.supabase
        .from('jobs')
        .update({ status: 'cancelled' })
        .eq('recurring_series_id', id)
        .eq('organization_id', ctx.workspace.organizationId)
        .gte('occurrence_date', today)
        .not('status', 'in', '("completed","done","complete","closed")');
    }
    return NextResponse.json({ ok: true, status: 'paused' });
  }

  if (action === 'resume') {
    await ctx.supabase
      .from('recurring_job_series')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', id);
    return NextResponse.json({ ok: true, status: 'active' });
  }

  if (action === 'end') {
    const endDate = body.endDate || body.fromDate || new Date().toISOString().slice(0, 10);
    await ctx.supabase
      .from('recurring_job_series')
      .update({ status: 'ended', end_date: endDate, updated_at: new Date().toISOString() })
      .eq('id', id);

    await ctx.supabase
      .from('jobs')
      .update({ status: 'cancelled' })
      .eq('recurring_series_id', id)
      .eq('organization_id', ctx.workspace.organizationId)
      .gt('occurrence_date', endDate)
      .not('status', 'in', '("completed","done","complete","closed")');

    return NextResponse.json({ ok: true, status: 'ended', endDate });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) patch.title = String(body.title).trim();
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.default_price !== undefined) patch.default_price = body.default_price;
  if (body.preferred_start_time !== undefined) patch.preferred_start_time = body.preferred_start_time;
  if (body.duration_minutes !== undefined) patch.duration_minutes = body.duration_minutes;
  if (body.timezone !== undefined) patch.timezone = body.timezone;
  if (body.endDate !== undefined) patch.end_date = body.endDate;

  await ctx.supabase.from('recurring_job_series').update(patch).eq('id', id);

  const fromDate = body.fromDate || new Date().toISOString().slice(0, 10);
  let jobsQuery = ctx.supabase
    .from('jobs')
    .select('id, status, occurrence_date')
    .eq('recurring_series_id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .eq('is_skipped', false);

  if (action === 'edit_future') {
    jobsQuery = jobsQuery.gte('occurrence_date', fromDate);
  }

  const { data: futureJobs } = await jobsQuery;
  const updatable = (futureJobs || []).filter((job) => !isCompletedLikeStatus(job.status));
  const jobPatch: Record<string, unknown> = {};
  if (body.title !== undefined) jobPatch.title = String(body.title).trim();
  if (body.notes !== undefined) jobPatch.notes = body.notes;
  if (body.default_price !== undefined) jobPatch.revenue_amount = body.default_price;
  if (body.timezone !== undefined) jobPatch.timezone = body.timezone;

  if (Object.keys(jobPatch).length && updatable.length) {
    await ctx.supabase
      .from('jobs')
      .update(jobPatch)
      .in(
        'id',
        updatable.map((job) => job.id)
      );
  }

  return NextResponse.json({
    ok: true,
    updatedJobCount: updatable.length,
    affectedJobIds: updatable.map((job) => job.id)
  });
}
