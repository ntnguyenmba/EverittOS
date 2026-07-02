import { NextResponse } from 'next/server';
import { isManagerRole } from '@/lib/roles';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

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
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ runs: data || [] });
}
