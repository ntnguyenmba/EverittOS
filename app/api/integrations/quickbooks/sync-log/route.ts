import { NextResponse } from 'next/server';
import { canSeeOrgWideData } from '@/lib/permissions';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!canSeeOrgWideData(ctx.workspace.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { data, error } = await ctx.supabase
    .from('quickbooks_sync_logs')
    .select('id, entity_type, entity_id, action, direction, status, external_id, error_message, created_at')
    .eq('organization_id', ctx.workspace.organizationId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ logs: data || [] });
}
