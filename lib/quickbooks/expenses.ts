import type { SupabaseClient } from '@supabase/supabase-js';
import { quickbooksAccountingRequest, type QuickBooksConnectionRecord } from '@/lib/quickbooks/client';

const CATEGORY_RULES: Array<[RegExp, string]> = [
  [/fuel|gas|mileage|auto|vehicle/i, 'Fuel and mileage'],
  [/software|subscription|hosting|technology/i, 'Software'],
  [/advertis|marketing|promotion/i, 'Advertising'],
  [/insurance/i, 'Insurance'],
  [/office|postage|printing/i, 'Office'],
  [/repair|maintenance/i, 'Repairs and maintenance'],
  [/legal|accounting|professional|consult/i, 'Professional services'],
  [/tax|fee|license|permit/i, 'Taxes and fees'],
  [/equipment|tool|rental/i, 'Equipment'],
  [/suppl|material|cleaning/i, 'Supplies']
];

type QuickBooksRef = { value?: string; name?: string };
type QuickBooksLine = {
  Amount?: number;
  Description?: string;
  DetailType?: string;
  AccountBasedExpenseLineDetail?: { AccountRef?: QuickBooksRef };
  ItemBasedExpenseLineDetail?: { ItemRef?: QuickBooksRef };
};

type QuickBooksExpenseEntity = {
  Id?: string;
  TxnDate?: string;
  TotalAmt?: number;
  PrivateNote?: string;
  DocNumber?: string;
  PaymentType?: string;
  EntityRef?: QuickBooksRef;
  VendorRef?: QuickBooksRef;
  AccountRef?: QuickBooksRef;
  Line?: QuickBooksLine[];
};

type QueryResponse = {
  QueryResponse?: {
    Purchase?: QuickBooksExpenseEntity[];
    Bill?: QuickBooksExpenseEntity[];
    startPosition?: number;
    maxResults?: number;
    totalCount?: number;
  };
};

export type QuickBooksExpenseSyncResult = {
  imported: number;
  updated: number;
  skipped: number;
  purchases: number;
  bills: number;
};

function clean(value: unknown): string | null {
  const text = String(value || '').trim();
  return text || null;
}

function categoryFor(entity: QuickBooksExpenseEntity): string {
  const accountNames = (entity.Line || [])
    .map((line) =>
      line.AccountBasedExpenseLineDetail?.AccountRef?.name ||
      line.ItemBasedExpenseLineDetail?.ItemRef?.name ||
      line.Description ||
      ''
    )
    .join(' ');

  for (const [pattern, category] of CATEGORY_RULES) {
    if (pattern.test(accountNames)) return category;
  }
  return 'Other';
}

function descriptionFor(entity: QuickBooksExpenseEntity, type: 'purchase' | 'bill'): string | null {
  const lineDescription = (entity.Line || [])
    .map((line) => clean(line.Description))
    .filter(Boolean)
    .join('; ');
  return clean(lineDescription) || clean(entity.PrivateNote) || `${type === 'bill' ? 'Bill' : 'Purchase'} imported from QuickBooks`;
}

async function queryEntities(
  admin: SupabaseClient,
  organizationId: string,
  connection: QuickBooksConnectionRecord,
  entityName: 'Purchase' | 'Bill'
): Promise<QuickBooksExpenseEntity[]> {
  const all: QuickBooksExpenseEntity[] = [];
  let startPosition = 1;
  const pageSize = 1000;

  for (;;) {
    const query = `select * from ${entityName} startposition ${startPosition} maxresults ${pageSize}`;
    const result = await quickbooksAccountingRequest<QueryResponse>({
      admin,
      organizationId,
      method: 'GET',
      path: '/query',
      query: { query },
      connection
    });

    const page = result.body.QueryResponse?.[entityName] || [];
    all.push(...page);
    if (page.length < pageSize) break;
    startPosition += page.length;
  }

  return all;
}

export async function syncQuickBooksExpenses(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
  connection: QuickBooksConnectionRecord
): Promise<QuickBooksExpenseSyncResult> {
  const [purchases, bills] = await Promise.all([
    queryEntities(admin, organizationId, connection, 'Purchase'),
    queryEntities(admin, organizationId, connection, 'Bill')
  ]);

  const entities = [
    ...purchases.map((entity) => ({ entity, type: 'purchase' as const })),
    ...bills.map((entity) => ({ entity, type: 'bill' as const }))
  ];

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const { entity, type } of entities) {
    const id = clean(entity.Id);
    const amount = Number(entity.TotalAmt || 0);
    if (!id || !Number.isFinite(amount) || amount <= 0) {
      skipped += 1;
      continue;
    }

    const externalId = `${type}:${id}`;
    const vendor = clean(entity.EntityRef?.name) || clean(entity.VendorRef?.name) || clean(entity.AccountRef?.name);
    const date = clean(entity.TxnDate) || new Date().toISOString().slice(0, 10);
    const notes = [clean(entity.PrivateNote), entity.DocNumber ? `QuickBooks document ${entity.DocNumber}` : null]
      .filter(Boolean)
      .join(' | ') || null;

    const row = {
      organization_id: organizationId,
      date,
      category: categoryFor(entity),
      vendor,
      description: descriptionFor(entity, type),
      amount,
      payment_method: clean(entity.PaymentType),
      notes,
      source: 'quickbooks',
      quickbooks_expense_id: externalId,
      created_by: userId,
      updated_at: new Date().toISOString()
    };

    const { data: existing, error: existingError } = await admin
      .from('expenses')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('quickbooks_expense_id', externalId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    if (existing?.id) {
      const { error } = await admin.from('expenses').update(row).eq('id', existing.id);
      if (error) throw new Error(error.message);
      updated += 1;
    } else {
      const { error } = await admin.from('expenses').insert(row);
      if (error) throw new Error(error.message);
      imported += 1;
    }
  }

  return { imported, updated, skipped, purchases: purchases.length, bills: bills.length };
}
