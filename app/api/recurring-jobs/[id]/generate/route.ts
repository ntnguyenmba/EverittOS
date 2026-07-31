import { NextResponse } from 'next/server';
import { generateSeriesWindow } from '@/lib/generate-recurring-series';
import { isValidUuid } from '@/lib/input-validation';
import { RECURRING_GENERATION_WINDOW_DAYS } from '@/lib/recurring-jobs';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** Extend the generated window for an active series without creating duplicates. */
export async function POST(_request: Request, context: RouteContext) {
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
  if (series.status !== 'active') {
    return NextResponse.json({ error: 'Only active series can generate new occurrences.' }, { status: 400 });
  }

  const result = await generateSeriesWindow(ctx.supabase, ctx.workspace, ctx.userId, series);

  return NextResponse.json({
    ok: true,
    created: result.created,
    windowDays: RECURRING_GENERATION_WINDOW_DAYS
  });
}
