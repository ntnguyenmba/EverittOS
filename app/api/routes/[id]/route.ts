import { NextResponse } from 'next/server';
import { isManagerRole } from '@/lib/roles';
import { isValidUuid } from '@/lib/input-validation';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
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

  const { data, error } = await ctx.supabase
    .from('route_optimization_runs')
    .select('*')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Route run not found.' }, { status: 404 });
  }

  return NextResponse.json({ run: data });
}
