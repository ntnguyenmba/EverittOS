import { after, NextResponse } from 'next/server';
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

type AdminClient = NonNullable<ReturnType<typeof createAdminSupabase>>;

type ExportCounts = {
  found: number;
  created: number;
  updated: number;
  failed: number;
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
}): Promise<void> {
  const { admin, organizationId, userId } = input;

  try {
    const connection = await loadQuickBooksConnection(admin, organizationId);
    if (!connection || !['connected', 'error', 'syncing'].includes(connection.status)) {
      throw new Error('QuickBooks is no longer connected. Reconnect your company before syncing.');
    }

    const validated = await ensureValidAccessToken(admin, connection);
    const activeConnection = validated.connection;
    const companyName = await fetchCompanyDisplayName(admin, organizationId, { connection: activeConnection });

    const customers = await exportExistingCustomers({ admin, organizationId, userId });
    const invoices = await exportExistingInvoices({ admin, organizationId, userId });
    const expenses = await syncQuickBooksExpenses(admin, organizationId, userId, activeConnection);

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
        userId,
        entityType: 'connection',
        action: 'sync',
        status: failures ? 'completed_with_errors' : 'completed',
        externalId: activeConnection.realm_id,
        errorMessage: failures ? `${failures} export failures` : null,
        httpStatus: 200
      }),
      writeQuickBooksSyncLog(admin, {
        organizationId,
        userId,
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
  }
}

/** Queue a QuickBooks sync and return immediately while Next.js finishes it after the response. */
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
  if (!connection || !['connected', 'error', 'syncing'].includes(connection.status)) {
    return NextResponse.json(
      { error: 'QuickBooks is not connected. Connect your company before syncing.', status: 'disconnected' },
      { status: 409 }
    );
  }

  if (connection.status === 'syncing') {
    return NextResponse.json(
      { ok: true, status: 'syncing', message: 'QuickBooks sync is already in progress.' },
      { status: 202 }
    );
  }

  const startedAt = new Date().toISOString();
  const { error: updateError } = await admin
    .from('quickbooks_connections')
    .update({ status: 'syncing', last_error: null, updated_at: startedAt })
    .eq('organization_id', organizationId);

  if (updateError) {
    return NextResponse.json({ error: `QuickBooks sync could not be started: ${updateError.message}` }, { status: 500 });
  }

  await writeQuickBooksSyncLog(admin, {
    organizationId,
    userId: ctx.userId,
    entityType: 'connection',
    action: 'sync',
    status: 'started',
    externalId: connection.realm_id,
    httpStatus: 202
  });

  after(async () => {
    await runQuickBooksSync({ admin, organizationId, userId: ctx.userId });
  });

  return NextResponse.json(
    {
      ok: true,
      status: 'syncing',
      startedAt,
      message: 'QuickBooks sync started. You can leave this page while it finishes.'
    },
    { status: 202 }
  );
}
