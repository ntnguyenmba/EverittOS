import { NextResponse } from 'next/server';
import { generateSeriesWindow } from '@/lib/generate-recurring-series';
import { isValidUuid } from '@/lib/input-validation';
import { isCompletedLikeStatus } from '@/lib/recurring-jobs';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

type ScheduleBody = {
  fromDate?: string;
  interval?: number;
  unit?: 'day' | 'week' | 'month';
  weekdays?: number[];
  startDate?: string;
  endMode?: 'never' | 'date' | 'count';
  endDate?: string | null;
  occurrenceLimit?: number | null;
  startTime?: string;
  durationMinutes?: number;
  timezone?: string | null;
};

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function databaseFrequency(unit: ScheduleBody['unit']) {
  if (unit === 'day') return 'daily';
  if (unit === 'month') return 'monthly';
  return 'weekly';
}

function databaseIntervalUnit(unit: ScheduleBody['unit']) {
  if (unit === 'day') return 'days';
  if (unit === 'month') return 'months';
  return 'weeks';
}

export async function PATCH(request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });

  const { id } = await context.params;
  if (!isValidUuid(id)) return NextResponse.json({ error: 'Invalid series id.' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as ScheduleBody;
  const interval = Math.max(1, Math.min(52, Math.floor(Number(body.interval || 1))));
  const unit = body.unit === 'day' || body.unit === 'month' ? body.unit : 'week';
  const weekdays = Array.from(new Set((body.weekdays || []).map(Number).filter((day) => day >= 0 && day <= 6))).sort();
  const durationMinutes = Math.max(15, Math.min(24 * 60, Math.floor(Number(body.durationMinutes || 60))));
  const occurrenceLimit = body.endMode === 'count'
    ? Math.max(1, Math.min(1000, Math.floor(Number(body.occurrenceLimit || 1))))
    : null;

  if (!validDate(body.startDate)) return NextResponse.json({ error: 'Choose a valid start date.' }, { status: 400 });
  if (!validTime(body.startTime)) return NextResponse.json({ error: 'Choose a valid start time.' }, { status: 400 });
  if (unit === 'week' && weekdays.length === 0) return NextResponse.json({ error: 'Choose at least one weekday.' }, { status: 400 });
  if (body.endMode === 'date' && !validDate(body.endDate)) return NextResponse.json({ error: 'Choose a valid end date.' }, { status: 400 });

  const { data: series, error: seriesError } = await ctx.supabase
    .from('recurring_job_series')
    .select('*')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (seriesError || !series) {
    return NextResponse.json({ error: seriesError ? mapWorkspaceSaveError(seriesError.message) : 'Series not found.' }, { status: seriesError ? 400 : 404 });
  }

  const endDate = body.endMode === 'date' ? body.endDate : null;
  const patch = {
    recurrence_frequency: databaseFrequency(unit),
    recurrence_interval: interval,
    recurrence_interval_unit: databaseIntervalUnit(unit),
    recurrence_weekday: unit === 'week' ? weekdays[0] : null,
    recurrence_weekdays: unit === 'week' ? weekdays : null,
    start_date: body.startDate,
    end_date: endDate,
    occurrence_limit: occurrenceLimit,
    preferred_start_time: body.startTime,
    duration_minutes: durationMinutes,
    timezone: body.timezone || series.timezone || null,
    updated_at: new Date().toISOString()
  };

  const { error: updateError } = await ctx.supabase
    .from('recurring_job_series')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId);

  if (updateError) return NextResponse.json({ error: mapWorkspaceSaveError(updateError.message) }, { status: 400 });

  const fromDate = validDate(body.fromDate) ? body.fromDate : body.startDate;
  const { data: futureRows, error: futureRowsError } = await ctx.supabase
    .from('jobs')
    .select('id, status, occurrence_date')
    .eq('recurring_series_id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .gte('occurrence_date', fromDate);

  if (futureRowsError) {
    return NextResponse.json({ error: mapWorkspaceSaveError(futureRowsError.message) }, { status: 400 });
  }

  const replaceableIds = (futureRows || [])
    .filter((job) => !isCompletedLikeStatus(job.status))
    .map((job) => String(job.id));

  if (replaceableIds.length) {
    const { error: deleteError } = await ctx.supabase
      .from('jobs')
      .delete()
      .in('id', replaceableIds)
      .eq('organization_id', ctx.workspace.organizationId);

    if (deleteError) {
      return NextResponse.json({ error: mapWorkspaceSaveError(deleteError.message) }, { status: 400 });
    }
  }

  const updatedSeries = { ...(series as Record<string, unknown>), ...patch, id, status: series.status || 'active' };
  const generation = await generateSeriesWindow(
    ctx.supabase,
    ctx.workspace,
    ctx.userId,
    updatedSeries as unknown as Parameters<typeof generateSeriesWindow>[3]
  );

  const { data: replacementJob } = await ctx.supabase
    .from('jobs')
    .select('id, occurrence_date')
    .eq('recurring_series_id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .gte('occurrence_date', fromDate)
    .eq('is_skipped', false)
    .not('status', 'in', '("cancelled","canceled","completed","done","complete","closed")')
    .order('occurrence_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    replacedFutureVisitCount: replaceableIds.length,
    replacementJobId: replacementJob?.id || null,
    generation,
    message: 'Recurring schedule updated. Past completed visits were not changed.'
  });
}
