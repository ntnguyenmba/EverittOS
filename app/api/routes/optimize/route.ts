import { NextResponse } from 'next/server';
import { buildHeuristicRoute } from '@/lib/route-optimization';
import { isManagerRole } from '@/lib/roles';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { publicErrorMessage } from '@/lib/safe-api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!isManagerRole(ctx.workspace.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { data, error } = await ctx.supabase
    .from('route_optimization_runs')
    .select('*')
    .eq('organization_id', ctx.workspace.organizationId)
    .order('service_date', { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 400 });
  }

  return NextResponse.json({ runs: data || [] });
}

export async function POST(request: Request) {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!isManagerRole(ctx.workspace.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = (await request.json()) as { service_date?: string };
  const serviceDate = body.service_date || new Date().toISOString().slice(0, 10);

  const { data: jobs, error: jobsError } = await ctx.supabase
    .from('jobs')
    .select('id, title, address, scheduled_start, status')
    .eq('organization_id', ctx.workspace.organizationId)
    .gte('scheduled_start', `${serviceDate}T00:00:00`)
    .lte('scheduled_start', `${serviceDate}T23:59:59`)
    .neq('status', 'cancelled');

  if (jobsError) {
    return NextResponse.json({ error: publicErrorMessage(jobsError) }, { status: 400 });
  }

  const scheduledJobs = (jobs || []).filter((j) => j.status !== 'completed');
  const route = buildHeuristicRoute(scheduledJobs);
  const inputJobIds = scheduledJobs.map((j) => j.id);

  const { data: run, error: runError } = await ctx.supabase
    .from('route_optimization_runs')
    .insert({
      organization_id: ctx.workspace.organizationId,
      service_date: serviceDate,
      status: 'draft',
      input_job_ids: inputJobIds,
      optimized_stops: route.stops,
      provider: route.provider,
      created_by: ctx.userId
    })
    .select('*')
    .single();

  if (runError) {
    return NextResponse.json({ error: publicErrorMessage(runError) }, { status: 400 });
  }

  return NextResponse.json({
    run,
    flaggedMissingAddress: route.flaggedMissingAddress,
    note: 'Basic ordering by address and schedule time. This is not true drive-time optimization.'
  });
}
