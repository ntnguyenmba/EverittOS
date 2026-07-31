import { NextResponse } from 'next/server';
import { isValidUuid } from '@/lib/input-validation';
import { isCompletedLikeStatus } from '@/lib/recurring-jobs';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Occurrence-level actions for jobs that belong to a recurring series.
 * edit_this_only | skip | cancel_visit
 */
export async function POST(request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { id } = await context.params;
  if (!isValidUuid(id)) return NextResponse.json({ error: 'Invalid job id.' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as {
    action?: 'edit_this_only' | 'skip' | 'cancel_visit';
    patch?: Record<string, unknown>;
  };

  const { data: job, error } = await ctx.supabase
    .from('jobs')
    .select('id, recurring_series_id, status, occurrence_date, organization_id')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (error || !job) {
    return NextResponse.json({ error: error ? mapWorkspaceSaveError(error.message) : 'Job not found.' }, { status: error ? 400 : 404 });
  }

  if (!job.recurring_series_id) {
    return NextResponse.json({ error: 'This job is not part of a recurring series.' }, { status: 400 });
  }

  if (isCompletedLikeStatus(job.status)) {
    return NextResponse.json({ error: 'Completed historical jobs cannot be changed by series actions.' }, { status: 400 });
  }

  const action = body.action || 'edit_this_only';

  if (action === 'skip' || action === 'cancel_visit') {
    const { data, error: updateError } = await ctx.supabase
      .from('jobs')
      .update({
        status: 'cancelled',
        is_skipped: action === 'skip',
        notes:
          action === 'skip'
            ? 'Skipped visit (series continues).'
            : undefined
      })
      .eq('id', id)
      .select('id, status, is_skipped')
      .single();

    if (updateError) {
      return NextResponse.json({ error: mapWorkspaceSaveError(updateError.message) }, { status: 400 });
    }

    // Keep the series populated after skipping.
    void fetch(new URL(`/api/recurring-jobs/${job.recurring_series_id}/generate`, request.url).toString(), {
      method: 'POST',
      headers: { cookie: request.headers.get('cookie') || '' }
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      job: data,
      seriesUntouched: true,
      message: action === 'skip' ? 'Visit skipped. The series continues.' : 'Visit cancelled. The series continues.'
    });
  }

  const allowed = new Set([
    'title',
    'notes',
    'address',
    'phone',
    'customer_name',
    'customer_email',
    'scheduled_start',
    'scheduled_end',
    'start_date',
    'due_date',
    'timezone',
    'revenue_amount',
    'expected_contractor_cost',
    'expected_additional_expense',
    'expected_expense_description',
    'assigned_to'
  ]);
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body.patch || {})) {
    if (allowed.has(key)) patch[key] = value;
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'No occurrence changes were provided.' }, { status: 400 });
  }

  const { data: updated, error: updateError } = await ctx.supabase
    .from('jobs')
    .update(patch)
    .eq('id', id)
    .select('id, title, status, scheduled_start, revenue_amount')
    .single();

  if (updateError) {
    return NextResponse.json({ error: mapWorkspaceSaveError(updateError.message) }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    job: updated,
    seriesUntouched: true,
    message: 'Only this occurrence was updated. Series defaults were not changed.'
  });
}
