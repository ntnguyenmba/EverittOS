import { NextResponse } from 'next/server';
import { quickbooksConfigured, quickbooksMissingCredentialsMessage } from '@/lib/quickbooks';
import { canManageOrganizationSettings } from '@/lib/roles';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const canConnect = canManageOrganizationSettings(ctx.workspace.role);
  const configured = quickbooksConfigured();

  const { data: connection } = await ctx.supabase
    .from('quickbooks_connections')
    .select('status, realm_id, last_sync_at, updated_at')
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  const { data: recentLogs } = await ctx.supabase
    .from('quickbooks_sync_logs')
    .select('id, entity_type, action, status, error_message, created_at')
    .eq('organization_id', ctx.workspace.organizationId)
    .order('created_at', { ascending: false })
    .limit(5);

  return NextResponse.json({
    configured,
    canConnect,
    canExport: ctx.canManage,
    connection: connection || { status: 'disconnected' },
    recentLogs: recentLogs || [],
    setupMessage: configured ? null : quickbooksMissingCredentialsMessage()
  });
}
