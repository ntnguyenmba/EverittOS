import { NextResponse } from 'next/server';
import { isManagerRole } from '@/lib/roles';
import { isValidUuid } from '@/lib/input-validation';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { publicErrorMessage } from '@/lib/safe-api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!isManagerRole(ctx.workspace.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { id } = await context.params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid route id.' }, { status: 400 });
  }

  const { data: run, error: readError } = await ctx.supabase
    .from('route_optimization_runs')
    .select('*')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: publicErrorMessage(readError) }, { status: 400 });
  }
  if (!run) {
    return NextResponse.json({ error: 'Route run not found.' }, { status: 404 });
  }

  const stops = (run.optimized_stops || []) as Array<{ job_id: string; sort_order: number }>;

  const { data: updated, error: updateError } = await ctx.supabase
    .from('route_optimization_runs')
    .update({ status: 'applied', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) {
    return NextResponse.json({ error: publicErrorMessage(updateError) }, { status: 400 });
  }

  return NextResponse.json({
    run: updated,
    stopCount: stops.length,
    message: 'Route order confirmed. Use the stop list when dispatching — schedule times were not changed automatically.'
  });
}
