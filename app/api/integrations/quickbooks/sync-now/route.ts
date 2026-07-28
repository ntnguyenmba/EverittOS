import { NextResponse } from 'next/server';
import { fetchCompanyDisplayName, loadQuickBooksConnection } from '@/lib/quickbooks';
import { writeQuickBooksSyncLog, logQuickBooksEvent } from '@/lib/quickbooks/logging';
import { canManageOrganizationSettings } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Verify the QuickBooks connection and refresh last_sync_at. Entity export remains manual per customer/invoice. */
export async function POST() {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!canManageOrganizationSettings(ctx.workspace.role)) {
    return NextResponse.json({ error: 'Only owners and admins can sync QuickBooks.' }, { status: 403 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'QuickBooks sync is not configured on the server.' }, { status: 503 });
  }

  const connection = await loadQuickBooksConnection(admin, ctx.workspace.organizationId);
  if (!connection || connection.status !== 'connected') {
    return NextResponse.json(
      { error: 'QuickBooks is not connected. Connect your company before syncing.', status: 'disconnected' },
      { status: 409 }
    );
  }

  try {
    const companyName = await fetchCompanyDisplayName(admin, ctx.workspace.organizationId, { connection });
    const now = new Date().toISOString();
    await admin
      .from('quickbooks_connections')
      .update({
        company_name: companyName || connection.company_name,
        last_sync_at: now,
        last_error: null,
        status: 'connected',
        updated_at: now
      })
      .eq('organization_id', ctx.workspace.organizationId);

    await writeQuickBooksSyncLog(admin, {
      organizationId: ctx.workspace.organizationId,
      userId: ctx.userId,
      entityType: 'connection',
      action: 'sync',
      status: 'completed',
      externalId: connection.realm_id,
      httpStatus: 200
    });

    logQuickBooksEvent('sync_now_verified', {
      organizationId: ctx.workspace.organizationId,
      realmId: connection.realm_id,
      companyName: companyName || connection.company_name
    });

    return NextResponse.json({
      ok: true,
      status: 'synced',
      companyName: companyName || connection.company_name,
      lastSyncAt: now,
      supported: {
        customers: 'Export from customer or invoice workflows (one-way to QuickBooks)',
        invoices: 'Export from invoice workflows (one-way to QuickBooks)',
        payments: 'Not synced yet',
        expenses: 'Not synced yet — enter expenses manually in EverittOS to avoid double counting'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'QuickBooks sync failed.';
    await admin
      .from('quickbooks_connections')
      .update({
        last_error: message.slice(0, 500),
        status: 'error',
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', ctx.workspace.organizationId);

    await writeQuickBooksSyncLog(admin, {
      organizationId: ctx.workspace.organizationId,
      userId: ctx.userId,
      entityType: 'connection',
      action: 'sync',
      status: 'failed',
      errorMessage: message.slice(0, 500),
      httpStatus: 400
    });

    return NextResponse.json({ error: message, status: 'failed' }, { status: 400 });
  }
}
