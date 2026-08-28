import { NextResponse } from 'next/server';
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
  const { data: job, error: jobError } = await ctx.supabase
    .from('jobs')
    .select('id, recurring_series_id, occurrence_date, start_date, status')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 400 });
  if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });

  const [invoices, payments, labor, expenses] = await Promise.all([
    ctx.supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.workspace.organizationId).eq('job_id', id),
    ctx.supabase.from('job_payments').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.workspace.organizationId).eq('job_id', id),
    ctx.supabase.from('job_labor').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.workspace.organizationId).eq('job_id', id),
    ctx.supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.workspace.organizationId).eq('job_id', id)
  ]);

  const counts = {
    invoices: invoices.error ? 0 : invoices.count || 0,
    payments: payments.error ? 0 : payments.count || 0,
    labor: labor.error ? 0 : labor.count || 0,
    expenses: expenses.error ? 0 : expenses.count || 0
  };
  const hasFinancialHistory = Object.values(counts).some((count) => count > 0);

  return NextResponse.json({
    canPermanentlyDelete: !hasFinancialHistory,
    hasFinancialHistory,
    counts,
    recurring: Boolean(job.recurring_series_id),
    status: job.status || null
  });
}
