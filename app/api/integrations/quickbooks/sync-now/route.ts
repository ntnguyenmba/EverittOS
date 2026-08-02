import { NextResponse } from 'next/server';
import { fetchCompanyDisplayName, loadQuickBooksConnection } from '@/lib/quickbooks';
import { ensureValidAccessToken } from '@/lib/quickbooks/client';
import { syncCustomerToQuickBooks } from '@/lib/quickbooks/customers';
import { exportEverittOSExpensesToQuickBooks } from '@/lib/quickbooks/expense-exports';
import { syncQuickBooksExpenses } from '@/lib/quickbooks/expenses';
import { exportEverittOSIncomeToQuickBooks } from '@/lib/quickbooks/income';
import { exportInvoiceToQuickBooks } from '@/lib/quickbooks/invoices';
import { writeQuickBooksSyncLog, logQuickBooksEvent } from '@/lib/quickbooks/logging';
import { canManageOrganizationSettings } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BULK_EXPORT_LIMIT = 50;

type AdminClient = NonNullable<ReturnType<typeof createAdminSupabase>>;

type ExportCounts = {
  found: number;
  created: number;
  updated: number;
  failed: number;
};

type SyncSummary = {
  companyName: string | null;
  customers: ExportCounts;
  invoices: ExportCounts;
  incomeExports: {
    found: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  expenseExports: {
    found: number;
    created: number;
    skipped: number;
    failed: number;
  };
  expenseImports: {
    imported: number;
    updated: number;
    skipped: number;
  };
};

async function exportExistingCustomers(input: {
  admin: AdminClient;
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
  admin: AdminClient;
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

async function runQuickBooksSync(input: {
  admin: AdminClient;
  organizationId: string;
  userId: string;
}): Promise<SyncSummary> {
  const { admin, organizationId, userId } = input;

  try {
    const connection = await loadQuickBooksConnection(admin, organizationId);
    if (!connection || connection.status !== 'syncing') {
      throw new Error('QuickBooks sync was stopped because the connection is no longer ready.');
    }

    const validated = await ensureValidAccessToken(admin, connection);
    const activeConnection = validated.connection;
    const companyName = await fetchCompanyDisplayName(admin, organizationId, { connection: activeConnection });

    const customers = await exportExistingCustomers({ admin, organizationId, userId });
    const invoices = await exportExistingInvoices({ admin, organizationId, userId });
    const incomeExports = await exportEverittOSIncomeToQuickBooks({
      admin,
      organizationId,
      userId,
      limit: BULK_EXPORT_LIMIT
    });
    const expenseExports = await exportEverittOSExpensesToQuickBooks({
      admin,
      organizationId,
      userId,
      limit: BULK_EXPORT_LIMIT
    });
    const expenseImports = await syncQuickBooksExpenses(admin, organizationId, userId, activeConnection);

    const now = new Date().toISOString();
    const failures = customers.failed + invoices.failed + incomeExports.failed + expenseExports.failed;
    const lastError = failures
      ? `${failures} financial record${failures === 1 ? '' : 's'} could not be synced. Open Recent sync activity for details.`
      : null;

    await admin
      .from('quickbooks_connections')
      .update({
        company_name: companyName || activeConnection.company_name,
        last_sync_at: now,
        last_error: lastError,
        status: 'connected',
        updated_at: now
      })
      .eq('organization_id', organizationId);

    await Promise.all([
      writeQuickBooksSyncLog(admin, {
        organizationId,
        userId,
        entityType: 'connection',
        action: 'sync',
        status: failures ? 'completed_with_errors' : 'completed',
        externalId: activeConnection.realm_id,
        errorMessage: lastError,
        httpStatus: 200
      }),
      writeQuickBooksSyncLog(admin, {
        organizationId,
        userId,
        entityType: 'income',
        action: 'export',
        status: incomeExports.failed ? 'completed_with_errors' : 'completed',
        externalId: activeConnection.realm_id,
        errorMessage: `Exported ${incomeExports.created}, updated ${incomeExports.updated}, skipped ${incomeExports.skipped}, failed ${incomeExports.failed}.`,
        httpStatus: 200
      }),
      writeQuickBooksSyncLog(admin, {
        organizationId,
        userId,
        entityType: 'expense',
        action: 'import',
        status: 'completed',
        externalId: activeConnection.realm_id,
        errorMessage: `Imported ${expenseImports.imported}, updated ${expenseImports.updated}, skipped ${expenseImports.skipped}.`,
        httpStatus: 200
      }),
      writeQuickBooksSyncLog(admin, {
        organizationId,
        userId,
        entityType: 'expense',
        action: 'export',
        status: expenseExports.failed ? 'completed_with_errors' : 'completed',
        externalId: activeConnection.realm_id,
        errorMessage: `Exported ${expenseExports.created}, skipped ${expenseExports.skipped}, failed ${expenseExports.failed}.`,
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
      incomeCreated: incomeExports.created,
      incomeUpdated: incomeExports.updated,
      incomeFailed: incomeExports.failed,
      expensesExported: expenseExports.created,
      expensesExportFailed: expenseExports.failed,
      expensesImported: expenseImports.imported,
      expensesUpdated: expenseImports.updated,
      expensesSkipped: expenseImports.skipped
    });

    return {
      companyName: companyName || activeConnection.company_name,
      customers,
      invoices,
      incomeExports,
      expenseExports,
      expenseImports
    };
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
      userId,
      entityType: 'connection',
      action: 'sync',
      status: 'failed',
      errorMessage: message.slice(0, 500),
      httpStatus: 400
    });

    throw error;
  }
}

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

  if (connection?.status === 'syncing') {
    return NextResponse.json(
      { error: 'A QuickBooks sync is already running. Refresh status in a moment.' },
      { status: 409 }
    );
  }

  if (!connection || connection.status !== 'connected') {
    return NextResponse.json(
      { error: 'Reconnect QuickBooks before syncing.', status: 'reconnect_required' },
      { status: 409 }
    );
  }

  try {
    await ensureValidAccessToken(admin, connection);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'QuickBooks authorization could not be verified.';
    await admin
      .from('quickbooks_connections')
      .update({
        last_error: message.slice(0, 500),
        status: 'error',
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', organizationId);

    return NextResponse.json(
      { error: message, status: 'reconnect_required' },
      { status: 409 }
    );
  }

  const startedAt = new Date().toISOString();
  const { error: updateError } = await admin
    .from('quickbooks_connections')
    .update({ status: 'syncing', last_error: null, updated_at: startedAt })
    .eq('organization_id', organizationId)
    .eq('status', 'connected');

  if (updateError) {
    return NextResponse.json({ error: `QuickBooks sync could not be started: ${updateError.message}` }, { status: 500 });
  }

  const refreshedConnection = await loadQuickBooksConnection(admin, organizationId);
  if (refreshedConnection?.status !== 'syncing') {
    return NextResponse.json(
      { error: 'QuickBooks sync could not be started because the connection changed. Refresh and try again.' },
      { status: 409 }
    );
  }

  await writeQuickBooksSyncLog(admin, {
    organizationId,
    userId: ctx.userId,
    entityType: 'connection',
    action: 'sync',
    status: 'started',
    externalId: connection.realm_id,
    httpStatus: 200
  });

  try {
    const summary = await runQuickBooksSync({ admin, organizationId, userId: ctx.userId });
    const importedExpenseCount = summary.expenseImports.imported + summary.expenseImports.updated;
    const directIncomeCount = summary.incomeExports.created + summary.incomeExports.updated;
    const message = [
      `${summary.customers.created + summary.customers.updated} customer${summary.customers.found === 1 ? '' : 's'} synced`,
      `${summary.invoices.created + summary.invoices.updated} invoice${summary.invoices.found === 1 ? '' : 's'} synced`,
      `${directIncomeCount} direct income payment${directIncomeCount === 1 ? '' : 's'} synced`,
      `${summary.expenseExports.created} expense${summary.expenseExports.created === 1 ? '' : 's'} exported`,
      `${importedExpenseCount} expense${importedExpenseCount === 1 ? '' : 's'} imported`
    ].join(', ');

    return NextResponse.json({
      ok: true,
      status: 'connected',
      startedAt,
      summary,
      message: `QuickBooks sync completed: ${message}.`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'QuickBooks sync failed.';
    return NextResponse.json({ error: message, status: 'sync_failed' }, { status: 500 });
  }
}
