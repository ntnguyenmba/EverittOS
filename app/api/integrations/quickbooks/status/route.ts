import { NextResponse } from 'next/server';
import { quickbooksConfigured, quickbooksMissingCredentialsMessage } from '@/lib/quickbooks';
import { loadQuickBooksConnection } from '@/lib/quickbooks/client';
import { canManageOrganizationSettings } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
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

  const admin = createAdminSupabase();
  let connectionSafe: {
    status: string;
    realm_id: string | null;
    company_name: string | null;
    last_sync_at: string | null;
    last_error: string | null;
    updated_at: string | null;
    needsReconnect: boolean;
  } | null = null;

  if (admin) {
    const connection = await loadQuickBooksConnection(admin, ctx.workspace.organizationId);
    if (connection) {
      connectionSafe = {
        status: connection.status,
        realm_id: connection.realm_id,
        company_name: connection.company_name,
        last_sync_at: connection.last_sync_at,
        last_error: connection.last_error,
        updated_at: connection.updated_at,
        needsReconnect: connection.status === 'error'
      };
    }
  }

  const { data: recentLogs } = await ctx.supabase
    .from('quickbooks_sync_logs')
    .select('id, entity_type, action, status, error_message, external_id, created_at')
    .eq('organization_id', ctx.workspace.organizationId)
    .order('created_at', { ascending: false })
    .limit(5);

  const status = connectionSafe?.status || 'disconnected';

  return NextResponse.json({
    configured,
    canConnect,
    canExport: ctx.canManage,
    connection: connectionSafe || { status: 'disconnected', needsReconnect: false },
    recentLogs: recentLogs || [],
    setupMessage: configured ? null : quickbooksMissingCredentialsMessage(),
    needsReconnect: status === 'error'
  });
}
