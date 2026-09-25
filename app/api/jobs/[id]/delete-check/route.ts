import { NextResponse } from 'next/server';
import { resolveOccurrenceAnchorDate, selectRecurringJobsForPermanentDelete } from '@/lib/job-permanent-delete';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { publicErrorMessage } from '@/lib/safe-api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });

  const { id } = await context.params;
  const { data: job, error: jobError } = await ctx.supabase
    .from('jobs')
    .select('id, recurring_series_id, occurrence_date, start_date, status')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (jobError) return NextResponse.json({ error: publicErrorMessage(jobError) }, { status: 400 });
  if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });

  let targetJobIds = [job.id];
  if (job.recurring_series_id) {
    const anchor = resolveOccurrenceAnchorDate(job);
    if (!anchor) return NextResponse.json({ error: 'This recurring visit is missing its occurrence date.' }, { status: 400 });
    const { data: seriesJobs, error: seriesError } = await ctx.supabase
      .from('jobs')
      .select('id, status, occurrence_date, start_date')
      .eq('organization_id', ctx.workspace.organizationId)
      .eq('recurring_series_id', job.recurring_series_id);
    if (seriesError) return NextResponse.json({ error: publicErrorMessage(seriesError) }, { status: 400 });
    targetJobIds = selectRecurringJobsForPermanentDelete(seriesJobs || [], job.id, anchor);
  }

  if (!targetJobIds.length) {
    return NextResponse.json({ canPermanentlyDelete: false, hasFinancialHistory: false, targetJobCount: 0, counts: { invoices:0, payments:0, labor:0, expenses:0 }, recurring: Boolean(job.recurring_series_id), status: job.status || null });
  }

  const [invoices, payments, labor, expenses] = await Promise.all([
    ctx.supabase.from('invoices').select('id', { count:'exact', head:true }).eq('organization_id', ctx.workspace.organizationId).in('job_id', targetJobIds),
    ctx.supabase.from('job_payments').select('id', { count:'exact', head:true }).eq('organization_id', ctx.workspace.organizationId).in('job_id', targetJobIds),
    ctx.supabase.from('job_labor').select('id', { count:'exact', head:true }).eq('organization_id', ctx.workspace.organizationId).in('job_id', targetJobIds),
    ctx.supabase.from('expenses').select('id', { count:'exact', head:true }).eq('organization_id', ctx.workspace.organizationId).in('job_id', targetJobIds)
  ]);

  const queryError = invoices.error || payments.error || labor.error || expenses.error;
  if (queryError) return NextResponse.json({ error: publicErrorMessage(queryError, 'Could not verify financial history.') }, { status: 500 });

  const counts = { invoices:invoices.count || 0, payments:payments.count || 0, labor:labor.count || 0, expenses:expenses.count || 0 };
  const hasFinancialHistory = counts.invoices > 0 || counts.payments > 0;
  return NextResponse.json({ canPermanentlyDelete: !hasFinancialHistory, hasFinancialHistory, targetJobCount: targetJobIds.length, counts, recurring:Boolean(job.recurring_series_id), status:job.status || null });
}
