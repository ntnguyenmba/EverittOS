import type { SupabaseClient } from '@supabase/supabase-js';
import { QuickBooksApiError, quickbooksAccountingRequest, type QuickBooksFetch } from '@/lib/quickbooks/client';
import { syncCustomerToQuickBooks } from '@/lib/quickbooks/customers';
import { parseQuickBooksError } from '@/lib/quickbooks/errors';
import { writeQuickBooksSyncLog } from '@/lib/quickbooks/logging';

type DirectPaymentRow = {
  id: string;
  organization_id: string;
  job_id: string;
  customer_id: string | null;
  invoice_id: string | null;
  amount: number | string;
  paid_at: string;
  payment_method: string | null;
  payment_reference: string | null;
  notes: string | null;
};

type JobRow = {
  id: string;
  title: string | null;
  customer_id: string | null;
  customer_name: string | null;
};

type SalesReceiptEntity = {
  Id: string;
  SyncToken: string;
};

type ItemQueryResponse = {
  QueryResponse?: {
    Item?: Array<{ Id: string }>;
  };
};

type AccountQueryResponse = {
  QueryResponse?: {
    Account?: Array<{ Id: string }>;
  };
};

type SalesReceiptResponse = {
  SalesReceipt?: SalesReceiptEntity;
};

type IncomeSyncLogRow = {
  external_id?: string | null;
};

export type DirectIncomeExportSummary = {
  found: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
};

async function resolveIncomeItemId(
  admin: SupabaseClient,
  organizationId: string,
  fetchImpl?: QuickBooksFetch
): Promise<string> {
  const serviceItems = await quickbooksAccountingRequest<ItemQueryResponse>({
    admin,
    organizationId,
    method: 'GET',
    path: '/query',
    query: {
      query: `select Id from Item where Type = 'Service' and Active = true maxresults 1`
    },
    fetchImpl
  });

  const existingId = serviceItems.body.QueryResponse?.Item?.[0]?.Id;
  if (existingId) return existingId;

  const incomeAccounts = await quickbooksAccountingRequest<AccountQueryResponse>({
    admin,
    organizationId,
    method: 'GET',
    path: '/query',
    query: {
      query: `select Id from Account where AccountType = 'Income' and Active = true maxresults 1`
    },
    fetchImpl
  });

  const incomeAccountId = incomeAccounts.body.QueryResponse?.Account?.[0]?.Id;
  if (!incomeAccountId) {
    throw new QuickBooksApiError({
      userMessage: 'QuickBooks needs an active income account before EverittOS income can be synced.',
      httpStatus: 400,
      intuitTid: incomeAccounts.intuitTid,
      reconnectRequired: false,
      retryable: false,
      code: 'missing_income_account'
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

  const createdId = created.body.Item?.Id;
  if (!createdId) {
    throw new QuickBooksApiError({
      userMessage: 'QuickBooks could not create the EverittOS income service item.',
      httpStatus: 400,
      intuitTid: created.intuitTid,
      reconnectRequired: false,
      retryable: false,
      code: 'missing_income_item'
    });
  }

  return createdId;
}

async function findVerifiedSalesReceipt(input: {
  admin: SupabaseClient;
  organizationId: string;
  paymentId: string;
  fetchImpl?: QuickBooksFetch;
}): Promise<SalesReceiptEntity | null> {
  const { data, error } = await input.admin
    .from('quickbooks_sync_logs')
    .select('external_id')
    .eq('organization_id', input.organizationId)
    .eq('entity_type', 'income')
    .eq('entity_id', input.paymentId)
    .eq('action', 'export_sales_receipt')
    .in('status', ['created', 'updated'])
    .not('external_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw new Error(`QuickBooks income history could not be checked: ${error.message}`);

  const externalId = ((data || []) as IncomeSyncLogRow[])[0]?.external_id;
  if (!externalId) return null;

  try {
    const result = await quickbooksAccountingRequest<SalesReceiptResponse>({
      admin: input.admin,
      organizationId: input.organizationId,
      method: 'GET',
      path: `/salesreceipt/${encodeURIComponent(externalId)}`,
      fetchImpl: input.fetchImpl
    });
    return result.body.SalesReceipt || null;
  } catch (error) {
    if (error instanceof QuickBooksApiError && error.parsed.httpStatus === 404) {
      return null;
    }
    throw error;
  }
}

async function exportDirectPayment(input: {
  admin: SupabaseClient;
  organizationId: string;
  userId?: string | null;
  payment: DirectPaymentRow;
  fetchImpl?: QuickBooksFetch;
}): Promise<'created' | 'updated' | 'skipped'> {
  const payment = input.payment;
  if (payment.invoice_id) return 'skipped';

  const amount = Number(payment.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0 || !payment.job_id || !payment.paid_at) {
    return 'skipped';
  }

  const existingReceipt = await findVerifiedSalesReceipt({
    admin: input.admin,
    organizationId: input.organizationId,
    paymentId: payment.id,
    fetchImpl: input.fetchImpl
  });
  if (existingReceipt) return 'skipped';

  const { data: job, error: jobError } = await input.admin
    .from('jobs')
    .select('id, title, customer_id, customer_name')
    .eq('id', payment.job_id)
    .eq('organization_id', input.organizationId)
    .maybeSingle();

  if (jobError) throw new Error(jobError.message);
  if (!job) return 'skipped';

  const jobRow = job as JobRow;
  const customerId = payment.customer_id || jobRow.customer_id;
  if (!customerId) return 'skipped';

  const customer = await syncCustomerToQuickBooks({
    admin: input.admin,
    organizationId: input.organizationId,
    userId: input.userId,
    customerId,
    fetchImpl: input.fetchImpl,
    log: true
  });
  const itemId = await resolveIncomeItemId(input.admin, input.organizationId, input.fetchImpl);
  const safeAmount = Math.max(0, amount);
  const note = payment.notes?.trim() || jobRow.title?.trim() || 'EverittOS job payment';

  const payload: Record<string, unknown> = {
    CustomerRef: { value: customer.externalId },
    TxnDate: payment.paid_at.slice(0, 10),
    PrivateNote: [
      note,
      `EverittOS payment ${payment.id}`,
      payment.payment_method ? `Method: ${payment.payment_method}` : '',
      payment.payment_reference ? `Reference: ${payment.payment_reference}` : ''
    ].filter(Boolean).join(' | ').slice(0, 4000),
    Line: [
      {
        Amount: safeAmount,
        DetailType: 'SalesItemLineDetail',
        Description: note.slice(0, 4000),
        SalesItemLineDetail: {
          ItemRef: { value: itemId },
          Qty: 1,
          UnitPrice: safeAmount
        }
      }
    ]
  };

  const response = await quickbooksAccountingRequest<SalesReceiptResponse>({
    admin: input.admin,
    organizationId: input.organizationId,
    method: 'POST',
    path: '/salesreceipt',
    body: payload,
    fetchImpl: input.fetchImpl
  });

  const entity = response.body.SalesReceipt;
  if (!entity?.Id || entity.SyncToken == null) {
    throw new QuickBooksApiError(
      parseQuickBooksError({ httpStatus: response.status, body: response.body, intuitTid: response.intuitTid })
    );
  }

  await writeQuickBooksSyncLog(input.admin, {
    organizationId: input.organizationId,
    userId: input.userId,
    entityType: 'income',
    entityId: payment.id,
    action: 'export_sales_receipt',
    status: 'created',
    externalId: entity.Id,
    intuitTid: response.intuitTid,
    httpStatus: 200
  });

  return 'created';
}

export async function exportEverittOSIncomeToQuickBooks(input: {
  admin: SupabaseClient;
  organizationId: string;
  userId?: string | null;
  limit?: number;
  fetchImpl?: QuickBooksFetch;
}): Promise<DirectIncomeExportSummary> {
  const { data, error } = await input.admin
    .from('job_payments')
    .select(
      'id, organization_id, job_id, customer_id, invoice_id, amount, paid_at, payment_method, payment_reference, notes'
    )
    .eq('organization_id', input.organizationId)
    .is('invoice_id', null)
    .order('paid_at', { ascending: true })
    .limit(input.limit || 50);

  if (error) throw new Error(`EverittOS income could not be loaded: ${error.message}`);

  const rows = (data || []) as DirectPaymentRow[];
  const summary: DirectIncomeExportSummary = {
    found: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0
  };

  for (const payment of rows) {
    try {
      const result = await exportDirectPayment({
        admin: input.admin,
        organizationId: input.organizationId,
        userId: input.userId,
        payment,
        fetchImpl: input.fetchImpl
      });
      summary[result] += 1;
    } catch (error) {
      summary.failed += 1;
      const message = error instanceof Error ? error.message : 'Direct income could not be exported.';
      await writeQuickBooksSyncLog(input.admin, {
        organizationId: input.organizationId,
        userId: input.userId,
        entityType: 'income',
        entityId: payment.id,
        action: 'export_sales_receipt',
        status: 'failed',
        errorMessage: message.slice(0, 500),
        httpStatus: 400
      });
    }
  }

  return summary;
}
