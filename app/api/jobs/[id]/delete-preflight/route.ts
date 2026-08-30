import { NextResponse } from 'next/server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { resolveOccurrenceAnchorDate, selectRecurringJobsForPermanentDelete } from '@/lib/job-permanent-delete';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });

  const { id } = await context.params;
  const { data: existing, error: readError } = await ctx.supabase
    .from('jobs')
    .select('id, status, recurring_series_id, occurrence_date, start_date')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (readError) return NextResponse.json({ error: mapWorkspaceSaveError(readError.message) }, { status: 400 });
  if (!existing) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });

  let jobIds = [existing.id];
  if (existing.recurring_series_id) {
    const anchor = resolveOccurrenceAnchorDate(existing);
    if (!anchor) return NextResponse.json({ error: 'This recurring visit is missing its occurrence date.' }, { status: 400 });
    const { data: seriesJobs, error } = await ctx.supabase
      .from('jobs')
      .select('id, status, occurrence_date, start_date')
      .eq('organization_id', ctx.workspace.organizationId)
      .eq('recurring_series_id', existing.recurring_series_id);
    if (error) return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
    jobIds = selectRecurringJobsForPermanentDelete(seriesJobs || [], existing.id, anchor);
  }

  if (!jobIds.length) return NextResponse.json({ canDelete: false, protected: true, reason: 'Completed historical visits are protected.' });

  const [invoices, payments, labor, expenses] = await Promise.all([
    ctx.supabase.from('invoices').select('id').eq('organization_id', ctx.workspace.organizationId).in('job_id', jobIds).limit(1),
    ctx.supabase.from('job_payments').select('id').eq('organization_id', ctx.workspace.organizationId).in('job_id', jobIds).limit(1),
    ctx.supabase.from('job_labor').select('id').eq('organization_id', ctx.workspace.organizationId).in('job_id', jobIds).limit(1),
    ctx.supabase.from('expenses').select('id').eq('organization_id', ctx.workspace.organizationId).in('job_id', jobIds).limit(1)
  ]);

  const queryError = invoices.error || payments.error || labor.error || expenses.error;
  if (queryError) return NextResponse.json({ error: mapWorkspaceSaveError(queryError.message) }, { status: 400 });

  const protectedByFinance = Boolean(invoices.data?.length || payments.data?.length || labor.data?.length || expenses.data?.length);
  return NextResponse.json({
    canDelete: !protectedByFinance,
    protected: protectedByFinance,
    targetJobCount: jobIds.length,
    reason: protectedByFinance
      ? 'This job has invoices, payments, worker labor, or expenses. Cancel it instead so financial history stays accurate.'
      : null
  });
}
