import type { SupabaseClient } from '@supabase/supabase-js';
import { QuickBooksApiError, quickbooksAccountingRequest } from '@/lib/quickbooks/client';
import { parseQuickBooksError } from '@/lib/quickbooks/errors';
import { writeQuickBooksSyncLog } from '@/lib/quickbooks/logging';

type ExpenseRow = {
  id: string;
  organization_id: string;
  date: string | null;
  category: string | null;
  vendor: string | null;
  description: string | null;
  amount: number | string | null;
  payment_method: string | null;
  notes: string | null;
  source: string | null;
  quickbooks_expense_id: string | null;
};

type QueryResponse = {
  QueryResponse?: {
    Account?: Array<{ Id: string; Name?: string; AccountType?: string }>;
  };
};

type PurchaseResponse = {
  Purchase?: { Id?: string; SyncToken?: string };
};

export type ExpenseExportCounts = {
  found: number;
  created: number;
  skipped: number;
  failed: number;
};

async function resolveAccountId(
  admin: SupabaseClient,
  organizationId: string,
  accountType: 'Bank' | 'Expense'
): Promise<string> {
  const result = await quickbooksAccountingRequest<QueryResponse>({
    admin,
    organizationId,
    method: 'GET',
    path: '/query',
    query: {
      query: `select Id, Name, AccountType from Account where AccountType = '${accountType}' and Active = true maxresults 1`
    }
  });

  const account = result.body.QueryResponse?.Account?.[0];
  if (!account?.Id) {
    throw new QuickBooksApiError({
      userMessage: `QuickBooks needs an active ${accountType.toLowerCase()} account before expenses can be exported.`,
      httpStatus: 400,
      intuitTid: result.intuitTid,
      reconnectRequired: false,
      retryable: false,
      code: `missing_${accountType.toLowerCase()}_account`
    });
  }
  return account.Id;
}

function paymentType(method: string | null): 'Cash' | 'CreditCard' {
  const normalized = String(method || '').toLowerCase();
  return normalized.includes('credit') || normalized.includes('card') ? 'CreditCard' : 'Cash';
}

export async function exportEverittOSExpensesToQuickBooks(input: {
  admin: SupabaseClient;
  organizationId: string;
  userId: string;
  limit?: number;
}): Promise<ExpenseExportCounts> {
  const { data, error } = await input.admin
    .from('expenses')
    .select('id, organization_id, date, category, vendor, description, amount, payment_method, notes, source, quickbooks_expense_id')
    .eq('organization_id', input.organizationId)
    .neq('source', 'quickbooks')
    .is('quickbooks_expense_id', null)
    .order('created_at', { ascending: true })
    .limit(input.limit || 50);

  if (error) throw new Error(`Expenses could not be loaded: ${error.message}`);

  const rows = (data || []) as ExpenseRow[];
  const counts: ExpenseExportCounts = { found: rows.length, created: 0, skipped: 0, failed: 0 };
  if (!rows.length) return counts;

  const [bankAccountId, expenseAccountId] = await Promise.all([
    resolveAccountId(input.admin, input.organizationId, 'Bank'),
    resolveAccountId(input.admin, input.organizationId, 'Expense')
  ]);

  for (const expense of rows) {
    const amount = Number(expense.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      counts.skipped += 1;
      continue;
    }

    const description = [expense.vendor, expense.description, expense.category]
      .filter(Boolean)
      .join(' - ')
      .slice(0, 4000) || 'EverittOS expense';

    try {
      const result = await quickbooksAccountingRequest<PurchaseResponse>({
        admin: input.admin,
        organizationId: input.organizationId,
        method: 'POST',
        path: '/purchase',
        body: {
          PaymentType: paymentType(expense.payment_method),
          AccountRef: { value: bankAccountId },
          TxnDate: expense.date || new Date().toISOString().slice(0, 10),
          PrivateNote: [expense.notes, `EverittOS expense ${expense.id}`].filter(Boolean).join(' | ').slice(0, 4000),
          Line: [
            {
              Amount: amount,
              DetailType: 'AccountBasedExpenseLineDetail',
              Description: description,
              AccountBasedExpenseLineDetail: {
                AccountRef: { value: expenseAccountId }
              }
            }
          ]
        }
      });

      const externalId = result.body.Purchase?.Id;
      if (!externalId) {
        throw new QuickBooksApiError(
          parseQuickBooksError({ httpStatus: result.status, body: result.body, intuitTid: result.intuitTid })
        );
      }

      const { error: updateError } = await input.admin
        .from('expenses')
        .update({
          quickbooks_expense_id: `purchase:${externalId}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', expense.id)
        .eq('organization_id', input.organizationId);
      if (updateError) throw new Error(updateError.message);

      await writeQuickBooksSyncLog(input.admin, {
        organizationId: input.organizationId,
        userId: input.userId,
        entityType: 'expense',
        entityId: expense.id,
        action: 'export_expense',
        status: 'created',
        externalId,
        intuitTid: result.intuitTid,
        httpStatus: 200
      });
      counts.created += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Expense export failed.';
      await writeQuickBooksSyncLog(input.admin, {
        organizationId: input.organizationId,
        userId: input.userId,
        entityType: 'expense',
        entityId: expense.id,
        action: 'export_expense',
        status: 'failed',
        errorMessage: message,
        httpStatus: error instanceof QuickBooksApiError ? error.parsed.httpStatus : 500,
        intuitTid: error instanceof QuickBooksApiError ? error.parsed.intuitTid : null,
        qbErrorCode: error instanceof QuickBooksApiError ? error.parsed.code || null : null
      });
      counts.failed += 1;
    }
  }

  return counts;
}
