import { NextResponse } from 'next/server';
import { fetchCompanyDisplayName, loadQuickBooksConnection } from '@/lib/quickbooks';
import { ensureValidAccessToken } from '@/lib/quickbooks/client';
import { syncCustomerToQuickBooks } from '@/lib/quickbooks/customers';
import { syncQuickBooksExpenses } from '@/lib/quickbooks/expenses';
import { exportInvoiceToQuickBooks } from '@/lib/quickbooks/invoices';
import { writeQuickBooksSyncLog, logQuickBooksEvent } from '@/lib/quickbooks/logging';
import { canManageOrganizationSettings } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BULK_EXPORT_LIMIT = 250;

type ExportCounts = {
  found: number;
  created: number;
  updated: number;
  failed: number;
};

async function exportExistingCustomers(input: {
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>;
  organizationId: string;
  userId: string;
}): Promise<ExportCounts> {
  const { data, error } = await input.admin
    .from('customers')
    .select('id')
    .eq('organization_id', input.organizationId)
    .order('created_at', { ascending: true })
    .limit(BULK_EXPORT_LIMIT);

  if (error) throw new Error(`Customers could not be loaded: ${error.message}`);

  const counts: ExportCounts = { found: data?.length || 0, created: 0, updated: 0, failed: 0 };
  for (const row of data || []) {
    try {
      const result = await syncCustomerToQuickBooks({
        admin: input.admin,
        organizationId: input.organizationId,
        userId: input.userId,
        customerId: row.id,
        log: true
      });
      if (result.created) counts.created += 1;
      else counts.updated += 1;
    } catch {
      counts.failed += 1;
    }
  }
  return counts;
}

async function exportExistingInvoices(input: {
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>;
  organizationId: string;
  userId: string;
}): Promise<ExportCounts> {
  const { data, error } = await input.admin
    .from('invoices')
    .select('id')
    .eq('organization_id', input.organizationId)
    .not('customer_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(BULK_EXPORT_LIMIT);

  if (error) throw new Error(`Invoices could not be loaded: ${error.message}`);

  const counts: ExportCounts = { found: data?.length || 0, created: 0, updated: 0, failed: 0 };
  for (const row of data || []) {
    try {
      const result = await exportInvoiceToQuickBooks({
        admin: input.admin,
        organizationId: input.organizationId,
        userId: input.userId,
        invoiceId: row.id
      });
      if (result.created) counts.created += 1;
      else counts.updated += 1;
    } catch {
      counts.failed += 1;
    }
  }
  return counts;
}

/** Export EverittOS customers and invoices, then import QuickBooks purchases and bills. */
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

  const organizationId = ctx.workspace.organizationId;
  const connection = await loadQuickBooksConnection(admin, organizationId);
  if (!connection || !['connected', 'error'].includes(connection.status)) {
    return NextResponse.json(
      { error: 'QuickBooks is not connected. Connect your company before syncing.', status: 'disconnected' },
      { status: 409 }
    );
  }

  try {
    const validated = await ensureValidAccessToken(admin, connection);
    const activeConnection = validated.connection;
    const companyName = await fetchCompanyDisplayName(admin, organizationId, { connection: activeConnection });

    // Run exports in sequence to avoid QuickBooks refresh-token and rate-limit conflicts.
    const customers = await exportExistingCustomers({ admin, organizationId, userId: ctx.userId });
    const invoices = await exportExistingInvoices({ admin, organizationId, userId: ctx.userId });
    const expenses = await syncQuickBooksExpenses(admin, organizationId, ctx.userId, activeConnection);

    const now = new Date().toISOString();
    const failures = customers.failed + invoices.failed;
    await admin
      .from('quickbooks_connections')
      .update({
        company_name: companyName || activeConnection.company_name,
        last_sync_at: now,
        last_error: failures ? `${failures} record${failures === 1 ? '' : 's'} could not be exported. Open Recent sync activity for details.` : null,
        status: 'connected',
        updated_at: now
      })
      .eq('organization_id', organizationId);

    await Promise.all([
      writeQuickBooksSyncLog(admin, {
        organizationId,
        userId: ctx.userId,
        entityType: 'connection',
        action: 'sync',
        status: failures ? 'completed_with_errors' : 'completed',
        externalId: activeConnection.realm_id,
        errorMessage: failures ? `${failures} export failures` : null,
        httpStatus: 200
      }),
      writeQuickBooksSyncLog(admin, {
        organizationId,
        userId: ctx.userId,
        entityType: 'expense',
        action: 'import',
        status: 'completed',
        externalId: activeConnection.realm_id,
        httpStatus: 200
      })
    ]);

    logQuickBooksEvent('sync_now_completed', {
      organizationId,
      realmId: activeConnection.realm_id,
      companyName: companyName || activeConnection.company_name,
      customersCreated: customers.created,
      customersUpdated: customers.updated,
      customersFailed: customers.failed,
      invoicesCreated: invoices.created,
      invoicesUpdated: invoices.updated,
      invoicesFailed: invoices.failed,
      expensesImported: expenses.imported,
      expensesUpdated: expenses.updated,
      expensesSkipped: expenses.skipped
    });

    const message = [
      `QuickBooks synced: ${customers.created} customers created, ${customers.updated} updated`,
      `${invoices.created} invoices created, ${invoices.updated} updated`,
      `${expenses.imported} expenses imported, ${expenses.updated} updated`,
      failures ? `${failures} failed` : null
    ].filter(Boolean).join(' · ');

    return NextResponse.json({
      ok: true,
      status: failures ? 'synced_with_errors' : 'synced',
      companyName: companyName || activeConnection.company_name,
      realmId: activeConnection.realm_id,
      lastSyncAt: now,
      customers,
      invoices,
      expenses,
      message,
      limited: customers.found >= BULK_EXPORT_LIMIT || invoices.found >= BULK_EXPORT_LIMIT,
      supported: {
        customers: 'Existing and new customers export to QuickBooks',
        invoices: 'Existing and new invoices export to QuickBooks',
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
      .eq('organization_id', organizationId);

    await writeQuickBooksSyncLog(admin, {
      organizationId,
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
