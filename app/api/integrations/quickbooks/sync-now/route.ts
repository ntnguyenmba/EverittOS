import { NextResponse } from 'next/server';
import { fetchCompanyDisplayName, loadQuickBooksConnection } from '@/lib/quickbooks';
import { ensureValidAccessToken } from '@/lib/quickbooks/client';
import { syncQuickBooksExpenses } from '@/lib/quickbooks/expenses';
import { writeQuickBooksSyncLog, logQuickBooksEvent } from '@/lib/quickbooks/logging';
import { canManageOrganizationSettings } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Verify the QuickBooks connection and import purchases and bills into EverittOS expenses. */
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
  if (!connection || !['connected', 'error'].includes(connection.status)) {
    return NextResponse.json(
      { error: 'QuickBooks is not connected. Connect your company before syncing.', status: 'disconnected' },
      { status: 409 }
    );
  }

  try {
    // Refresh once before starting concurrent Accounting API calls. QuickBooks rotates
    // refresh tokens, so allowing each request to refresh independently can invalidate
    // sibling requests and make Sync Now appear successful while importing nothing.
    const validated = await ensureValidAccessToken(admin, connection);
    const activeConnection = validated.connection;

    const [companyName, expenseSync] = await Promise.all([
      fetchCompanyDisplayName(admin, ctx.workspace.organizationId, { connection: activeConnection }),
      syncQuickBooksExpenses(admin, ctx.workspace.organizationId, ctx.userId, activeConnection)
    ]);

    const now = new Date().toISOString();
    await admin
      .from('quickbooks_connections')
      .update({
        company_name: companyName || activeConnection.company_name,
        last_sync_at: now,
        last_error: null,
        status: 'connected',
        updated_at: now
      })
      .eq('organization_id', ctx.workspace.organizationId);

    await Promise.all([
      writeQuickBooksSyncLog(admin, {
        organizationId: ctx.workspace.organizationId,
        userId: ctx.userId,
        entityType: 'connection',
        action: 'sync',
        status: 'completed',
        externalId: activeConnection.realm_id,
        httpStatus: 200
      }),
      writeQuickBooksSyncLog(admin, {
        organizationId: ctx.workspace.organizationId,
        userId: ctx.userId,
        entityType: 'expense',
        action: 'import',
        status: 'completed',
        externalId: activeConnection.realm_id,
        httpStatus: 200
      })
    ]);

    logQuickBooksEvent('sync_now_completed', {
      organizationId: ctx.workspace.organizationId,
      realmId: activeConnection.realm_id,
      companyName: companyName || activeConnection.company_name,
      expensesImported: expenseSync.imported,
      expensesUpdated: expenseSync.updated,
      expensesSkipped: expenseSync.skipped,
      purchasesFound: expenseSync.purchases,
      billsFound: expenseSync.bills
    });

    const recordsFound = expenseSync.purchases + expenseSync.bills;
    const message = recordsFound === 0
      ? 'QuickBooks sync completed, but no posted purchases or bills were found.'
      : `QuickBooks synced. ${expenseSync.imported} expenses imported, ${expenseSync.updated} updated, and ${expenseSync.skipped} skipped.`;

    return NextResponse.json({
      ok: true,
      status: 'synced',
      companyName: companyName || activeConnection.company_name,
      realmId: activeConnection.realm_id,
      lastSyncAt: now,
      recordsFound,
      expenses: expenseSync,
      message,
      supported: {
        customers: 'Export from customer or invoice workflows (one-way to QuickBooks)',
        invoices: 'Export from invoice workflows (one-way to QuickBooks)',
        payments: 'QuickBooks payments reconcile exported EverittOS invoices',
        expenses: 'Posted purchases and bills import from QuickBooks into EverittOS'
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
      entityType: 'expense',
      action: 'import',
      status: 'failed',
      errorMessage: message.slice(0, 500),
      httpStatus: 400
    });

    return NextResponse.json({ error: message, status: 'failed' }, { status: 400 });
  }
}
