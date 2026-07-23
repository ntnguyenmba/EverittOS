import type { SupabaseClient } from '@supabase/supabase-js';
import { QuickBooksApiError, quickbooksAccountingRequest, type QuickBooksFetch } from '@/lib/quickbooks/client';
import { escapeQuickBooksQueryValue, parseQuickBooksError } from '@/lib/quickbooks/errors';
import { syncCustomerToQuickBooks } from '@/lib/quickbooks/customers';
import { writeQuickBooksSyncLog } from '@/lib/quickbooks/logging';

export type EverittInvoiceRow = {
  id: string;
  organization_id: string;
  customer_id: string | null;
  amount: number | string | null;
  description?: string | null;
  notes?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  status?: string | null;
  payment_status?: string | null;
  quickbooks_invoice_id?: string | null;
  quickbooks_sync_token?: string | null;
};

export type QuickBooksInvoiceEntity = {
  Id: string;
  SyncToken: string;
  DocNumber?: string;
};

export type ExportInvoiceResult = {
  success: true;
  created: boolean;
  updated: boolean;
  externalId: string;
  syncToken: string;
  customerExternalId: string;
  intuitTid: string | null;
};

type ItemQueryResponse = {
  QueryResponse?: {
    Item?: Array<{ Id: string; Name?: string; Type?: string }>;
  };
};

type InvoiceReadResponse = {
  Invoice?: QuickBooksInvoiceEntity;
};

type AccountQueryResponse = {
  QueryResponse?: {
    Account?: Array<{ Id: string; Name?: string }>;
  };
};

async function resolveServiceItemId(
  admin: SupabaseClient,
  organizationId: string,
  fetchImpl?: QuickBooksFetch
): Promise<string> {
  const query = await quickbooksAccountingRequest<ItemQueryResponse>({
    admin,
    organizationId,
    method: 'GET',
    path: '/query',
    query: {
      query: `select Id, Name, Type from Item where Type = 'Service' and Active = true maxresults 1`
    },
    fetchImpl
  });

  const existing = query.body.QueryResponse?.Item?.[0];
  if (existing?.Id) return existing.Id;

  const anyItem = await quickbooksAccountingRequest<ItemQueryResponse>({
    admin,
    organizationId,
    method: 'GET',
    path: '/query',
    query: { query: `select Id from Item where Active = true maxresults 1` },
    fetchImpl
  });
  const fallback = anyItem.body.QueryResponse?.Item?.[0]?.Id;
  if (fallback) return fallback;

  const incomeAccounts = await quickbooksAccountingRequest<AccountQueryResponse>({
    admin,
    organizationId,
    method: 'GET',
    path: '/query',
    query: {
      query: `select Id, Name from Account where AccountType = 'Income' and Active = true maxresults 1`
    },
    fetchImpl
  });
  const incomeAccountId = incomeAccounts.body.QueryResponse?.Account?.[0]?.Id;
  if (!incomeAccountId) {
    throw new QuickBooksApiError({
      userMessage:
        'QuickBooks needs a Service item before invoices can be exported. Add a Service item in QuickBooks, then try again.',
      httpStatus: 400,
      intuitTid: incomeAccounts.intuitTid,
      reconnectRequired: false,
      retryable: false,
      code: 'missing_item'
    });
  }

  const created = await quickbooksAccountingRequest<{ Item?: { Id?: string } }>({
    admin,
    organizationId,
    method: 'POST',
    path: '/item',
    body: {
      Name: 'EverittOS Services',
      Type: 'Service',
      IncomeAccountRef: { value: incomeAccountId }
    },
    fetchImpl
  });

  if (!created.body.Item?.Id) {
    throw new QuickBooksApiError({
      userMessage:
        'QuickBooks needs a Service item before invoices can be exported. Add a Service item in QuickBooks, then try again.',
      httpStatus: 400,
      intuitTid: created.intuitTid,
      reconnectRequired: false,
      retryable: false,
      code: 'missing_item'
    });
  }

  return created.body.Item.Id;
}

export function buildQuickBooksInvoicePayload(input: {
  invoice: EverittInvoiceRow;
  customerExternalId: string;
  itemId: string;
  existing?: QuickBooksInvoiceEntity | null;
}): Record<string, unknown> {
  const amount = Number(input.invoice.amount || 0);
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const description =
    input.invoice.description?.trim() ||
    input.invoice.notes?.trim() ||
    'Services';

  const payload: Record<string, unknown> = {
    CustomerRef: { value: input.customerExternalId },
    Line: [
      {
        Amount: safeAmount,
        DetailType: 'SalesItemLineDetail',
        Description: description.slice(0, 4000),
        SalesItemLineDetail: {
          ItemRef: { value: input.itemId },
          Qty: 1,
          UnitPrice: safeAmount
        }
      }
    ]
  };

  if (input.invoice.invoice_date) {
    payload.TxnDate = input.invoice.invoice_date.slice(0, 10);
  }
  if (input.invoice.due_date) {
    payload.DueDate = input.invoice.due_date.slice(0, 10);
  }
  if (input.invoice.notes?.trim()) {
    payload.PrivateNote = input.invoice.notes.trim().slice(0, 4000);
  }
  if (input.invoice.description?.trim()) {
    payload.CustomerMemo = { value: input.invoice.description.trim().slice(0, 1000) };
  }

  // DocNumber: use a short stable reference without inventing tax codes.
  payload.DocNumber = `EV-${input.invoice.id.replace(/-/g, '').slice(0, 11)}`;

  if (input.existing?.Id) {
    payload.Id = input.existing.Id;
    payload.SyncToken = input.existing.SyncToken;
    payload.sparse = true;
  }

  return payload;
}

async function loadExistingInvoice(
  admin: SupabaseClient,
  organizationId: string,
  invoice: EverittInvoiceRow,
  fetchImpl?: QuickBooksFetch
): Promise<QuickBooksInvoiceEntity | null> {
  if (!invoice.quickbooks_invoice_id) return null;
  try {
    const result = await quickbooksAccountingRequest<InvoiceReadResponse>({
      admin,
      organizationId,
      method: 'GET',
      path: `/invoice/${encodeURIComponent(invoice.quickbooks_invoice_id)}`,
      fetchImpl
    });
    return result.body.Invoice || null;
  } catch (error) {
    if (error instanceof QuickBooksApiError && error.parsed.httpStatus === 404) {
      return null;
    }
    throw error;
  }
}

export async function exportInvoiceToQuickBooks(input: {
  admin: SupabaseClient;
  organizationId: string;
  userId?: string | null;
  invoiceId: string;
  fetchImpl?: QuickBooksFetch;
}): Promise<ExportInvoiceResult> {
  const { data: invoice, error } = await input.admin
    .from('invoices')
    .select(
      'id, organization_id, customer_id, amount, description, notes, invoice_date, due_date, status, payment_status, quickbooks_invoice_id, quickbooks_sync_token'
    )
    .eq('id', input.invoiceId)
    .eq('organization_id', input.organizationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!invoice) {
    throw new QuickBooksApiError({
      userMessage: 'Invoice not found in this workspace.',
      httpStatus: 404,
      intuitTid: null,
      reconnectRequired: false,
      retryable: false,
      code: 'invoice_not_found'
    });
  }

  const row = invoice as EverittInvoiceRow;
  if (!row.customer_id) {
    throw new QuickBooksApiError({
      userMessage: 'This invoice has no customer. Add a customer before exporting to QuickBooks.',
      httpStatus: 400,
      intuitTid: null,
      reconnectRequired: false,
      retryable: false,
      code: 'missing_customer'
    });
  }

  try {
    const customerSync = await syncCustomerToQuickBooks({
      admin: input.admin,
      organizationId: input.organizationId,
      userId: input.userId,
      customerId: row.customer_id,
      fetchImpl: input.fetchImpl,
      log: true
    });

    const itemId = await resolveServiceItemId(input.admin, input.organizationId, input.fetchImpl);
    const existing = await loadExistingInvoice(input.admin, input.organizationId, row, input.fetchImpl);
    const payload = buildQuickBooksInvoicePayload({
      invoice: row,
      customerExternalId: customerSync.externalId,
      itemId,
      existing
    });

    const result = await quickbooksAccountingRequest<InvoiceReadResponse>({
      admin: input.admin,
      organizationId: input.organizationId,
      method: 'POST',
      path: '/invoice',
      body: payload,
      fetchImpl: input.fetchImpl
    });

    const entity = result.body.Invoice;
    if (!entity?.Id || entity.SyncToken == null) {
      throw new QuickBooksApiError(
        parseQuickBooksError({ httpStatus: result.status, body: result.body, intuitTid: result.intuitTid })
      );
    }

    const created = !existing;
    const { error: updateError } = await input.admin
      .from('invoices')
      .update({
        quickbooks_invoice_id: entity.Id,
        quickbooks_sync_token: entity.SyncToken,
        updated_at: new Date().toISOString()
      })
      .eq('id', row.id)
      .eq('organization_id', input.organizationId);

    if (updateError) throw new Error(updateError.message);

    await input.admin
      .from('quickbooks_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', input.organizationId);

    await writeQuickBooksSyncLog(input.admin, {
      organizationId: input.organizationId,
      userId: input.userId,
      entityType: 'invoice',
      entityId: row.id,
      action: 'export_invoice',
      status: created ? 'created' : 'updated',
      externalId: entity.Id,
      intuitTid: result.intuitTid,
      httpStatus: 200
    });

    return {
      success: true,
      created,
      updated: !created,
      externalId: entity.Id,
      syncToken: entity.SyncToken,
      customerExternalId: customerSync.externalId,
      intuitTid: result.intuitTid
    };
  } catch (error) {
    const parsed =
      error instanceof QuickBooksApiError
        ? error.parsed
        : parseQuickBooksError({
            httpStatus: 500,
            body: { error: error instanceof Error ? error.message : 'unknown' },
            intuitTid: null
          });

    await writeQuickBooksSyncLog(input.admin, {
      organizationId: input.organizationId,
      userId: input.userId,
      entityType: 'invoice',
      entityId: row.id,
      action: 'export_invoice',
      status: 'failed',
      errorMessage: parsed.userMessage,
      intuitTid: parsed.intuitTid,
      httpStatus: parsed.httpStatus,
      qbErrorCode: parsed.code || null,
      faultType: parsed.faultType || null
    });

    await input.admin
      .from('quickbooks_connections')
      .update({
        last_error: parsed.userMessage,
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', input.organizationId);

    throw error instanceof QuickBooksApiError ? error : new QuickBooksApiError(parsed);
  }
}

/** Exported for tests — confirms query escaping path is used for DocNumber uniqueness checks if needed. */
export function escapedInvoiceDocNumber(invoiceId: string): string {
  return escapeQuickBooksQueryValue(`EV-${invoiceId.replace(/-/g, '').slice(0, 11)}`);
}
