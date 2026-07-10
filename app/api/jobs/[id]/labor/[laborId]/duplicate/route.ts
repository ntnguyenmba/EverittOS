import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { isValidUuid } from '@/lib/input-validation';

type RouteParams = { params: Promise<{ id: string; laborId: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { id: jobId, laborId } = await params;
  if (!isValidUuid(jobId) || !isValidUuid(laborId)) {
    return NextResponse.json({ error: 'Invalid job or contractor pay entry id' }, { status: 400 });
  }

  const { data: job } = await ctx.supabase
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const { data: source, error: sourceError } = await ctx.supabase
    .from('job_labor')
    .select('worker_id, worker_name, hours, hourly_cost, total_cost, notes')
    .eq('id', laborId)
    .eq('job_id', jobId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();

  if (sourceError || !source) {
    return NextResponse.json({ error: sourceError?.message || 'Contractor pay entry not found' }, { status: 404 });
  }

  const duplicateNotes = [source.notes, `Duplicated ${new Date().toLocaleDateString('en-US')}`]
    .filter(Boolean)
    .join(' · ');

  const { data: duplicated, error } = await ctx.supabase
    .from('job_labor')
    .insert({
      organization_id: ctx.organizationId,
      job_id: jobId,
      worker_id: source.worker_id,
      worker_name: source.worker_name,
      hours: source.hours,
      hourly_cost: source.hourly_cost,
      total_cost: source.total_cost,
      notes: duplicateNotes
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ labor: duplicated, message: 'Contractor pay entry duplicated.' });
}
