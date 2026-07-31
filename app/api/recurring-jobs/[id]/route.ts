import { NextResponse } from 'next/server';
import { generateSeriesWindow } from '@/lib/generate-recurring-series';
import { isValidUuid } from '@/lib/input-validation';
import { parseMoneyDollars } from '@/lib/money-decimal';
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
    .select(
      'id, title, status, occurrence_date, scheduled_start, revenue_amount, expected_contractor_cost, expected_additional_expense, is_skipped, assigned_to'
    )
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
    action?: 'pause' | 'resume' | 'end' | 'edit_series' | 'edit_future' | 'assign_contractor';
    fromDate?: string;
    endDate?: string | null;
    title?: string;
    notes?: string | null;
    default_price?: number | null;
    expected_contractor_cost?: number | null;
    expected_additional_expense?: number | null;
    expected_expense_description?: string | null;
    preferred_contractor_id?: string | null;
    preferred_start_time?: string | null;
    duration_minutes?: number | null;
    timezone?: string | null;
    cancelFutureJobs?: boolean;
    assignmentScope?: 'this_job_only' | 'this_and_future' | 'entire_series';
    jobId?: string;
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
    const generation = await generateSeriesWindow(ctx.supabase, ctx.workspace, ctx.userId, {
      ...(series as Record<string, unknown>),
      id,
      status: 'active'
    } as Parameters<typeof generateSeriesWindow>[3]);
    return NextResponse.json({ ok: true, status: 'active', generation });
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

  if (action === 'assign_contractor') {
    const workerId = body.preferred_contractor_id?.trim() || null;
    const scope = body.assignmentScope || 'this_job_only';
    const fromDate = body.fromDate || new Date().toISOString().slice(0, 10);

    if (scope === 'entire_series' || scope === 'this_and_future') {
      await ctx.supabase
        .from('recurring_job_series')
        .update({ preferred_contractor_id: workerId, updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    let jobsQuery = ctx.supabase
      .from('jobs')
      .select('id, status, occurrence_date')
      .eq('recurring_series_id', id)
      .eq('organization_id', ctx.workspace.organizationId)
      .eq('is_skipped', false);

    if (scope === 'this_job_only' && body.jobId) {
      jobsQuery = jobsQuery.eq('id', body.jobId);
    } else if (scope === 'this_and_future') {
      jobsQuery = jobsQuery.gte('occurrence_date', fromDate);
    }

    const { data: jobs } = await jobsQuery;
    const updatable = (jobs || []).filter((job) => !isCompletedLikeStatus(job.status));
    for (const job of updatable) {
      await ctx.supabase
        .from('jobs')
        .update({ assigned_to: workerId })
        .eq('id', job.id)
        .eq('organization_id', ctx.workspace.organizationId);
      if (workerId) {
        await ctx.supabase.from('job_assignments').upsert(
          {
            job_id: job.id,
            worker_id: workerId,
            user_id: ctx.userId,
            organization_id: ctx.workspace.organizationId
          },
          { onConflict: 'job_id,worker_id', ignoreDuplicates: true }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      updatedJobCount: updatable.length,
      affectedJobIds: updatable.map((job) => job.id),
      scope
    });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) patch.title = String(body.title).trim();
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.default_price !== undefined) patch.default_price = parseMoneyDollars(body.default_price);
  if (body.expected_contractor_cost !== undefined) {
    patch.default_contractor_cost = parseMoneyDollars(body.expected_contractor_cost);
  }
  if (body.expected_additional_expense !== undefined) {
    patch.default_additional_expense = parseMoneyDollars(body.expected_additional_expense);
  }
  if (body.expected_expense_description !== undefined) {
    patch.default_expense_description = body.expected_expense_description;
  }
  if (body.preferred_start_time !== undefined) patch.preferred_start_time = body.preferred_start_time;
  if (body.duration_minutes !== undefined) patch.duration_minutes = body.duration_minutes;
  if (body.timezone !== undefined) patch.timezone = body.timezone;
  if (body.endDate !== undefined) patch.end_date = body.endDate;
  if (body.preferred_contractor_id !== undefined) patch.preferred_contractor_id = body.preferred_contractor_id;

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
  if (body.default_price !== undefined) jobPatch.revenue_amount = parseMoneyDollars(body.default_price);
  if (body.expected_contractor_cost !== undefined) {
    jobPatch.expected_contractor_cost = parseMoneyDollars(body.expected_contractor_cost);
  }
  if (body.expected_additional_expense !== undefined) {
    jobPatch.expected_additional_expense = parseMoneyDollars(body.expected_additional_expense);
  }
  if (body.expected_expense_description !== undefined) {
    jobPatch.expected_expense_description = body.expected_expense_description;
  }
  if (body.timezone !== undefined) jobPatch.timezone = body.timezone;
  if (body.preferred_contractor_id !== undefined) jobPatch.assigned_to = body.preferred_contractor_id;

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
