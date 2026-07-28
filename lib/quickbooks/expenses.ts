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
  LinkedTxn?: Array<{ TxnId?: string; TxnType?: string }>;
  AccountBasedExpenseLineDetail?: { AccountRef?: QuickBooksRef; CustomerRef?: QuickBooksRef };
  ItemBasedExpenseLineDetail?: { ItemRef?: QuickBooksRef; CustomerRef?: QuickBooksRef };
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

type QuickBooksPaymentEntity = {
  Id?: string;
  TxnDate?: string;
  TotalAmt?: number;
  CustomerRef?: QuickBooksRef;
  PaymentMethodRef?: QuickBooksRef;
  PaymentRefNum?: string;
  PrivateNote?: string;
  Line?: QuickBooksLine[];
};

type QueryResponse = {
  QueryResponse?: {
    Purchase?: QuickBooksExpenseEntity[];
    Bill?: QuickBooksExpenseEntity[];
    Payment?: QuickBooksPaymentEntity[];
    startPosition?: number;
    maxResults?: number;
    totalCount?: number;
  };
};

type CustomerMatch = {
  id: string;
  quickbooks_customer_id: string | null;
};

type JobMatch = {
  id: string;
  customer_id: string | null;
  title: string | null;
};

export type QuickBooksExpenseSyncResult = {
  imported: number;
  updated: number;
  skipped: number;
  purchases: number;
  bills: number;
  payments: number;
  invoicesReconciled: number;
  unmatchedPayments: number;
  customerMatches: number;
  jobMatches: number;
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

function accountNamesFor(entity: QuickBooksExpenseEntity): string[] {
  return Array.from(
    new Set(
      (entity.Line || [])
        .map(
          (line) =>
            clean(line.AccountBasedExpenseLineDetail?.AccountRef?.name) ||
            clean(line.ItemBasedExpenseLineDetail?.ItemRef?.name)
        )
        .filter((value): value is string => Boolean(value))
    )
  );
}

function customerExternalIdFor(entity: QuickBooksExpenseEntity): string | null {
  for (const line of entity.Line || []) {
    const value =
      clean(line.AccountBasedExpenseLineDetail?.CustomerRef?.value) ||
      clean(line.ItemBasedExpenseLineDetail?.CustomerRef?.value);
    if (value) return value;
  }
  return null;
}

function descriptionFor(entity: QuickBooksExpenseEntity, type: 'purchase' | 'bill'): string | null {
  const lineDescription = (entity.Line || [])
    .map((line) => clean(line.Description))
    .filter(Boolean)
    .join('; ');
  return clean(lineDescription) || clean(entity.PrivateNote) || `${type === 'bill' ? 'Bill' : 'Purchase'} imported from QuickBooks`;
}

async function queryEntities<T>(
  admin: SupabaseClient,
  organizationId: string,
  connection: QuickBooksConnectionRecord,
  entityName: 'Purchase' | 'Bill' | 'Payment'
): Promise<T[]> {
  const all: T[] = [];
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

    const page = (result.body.QueryResponse?.[entityName] || []) as T[];
    all.push(...page);
    if (page.length < pageSize) break;
    startPosition += page.length;
  }

  return all;
}

async function loadExpenseMatches(admin: SupabaseClient, organizationId: string) {
  const [{ data: customers, error: customerError }, { data: jobs, error: jobError }] = await Promise.all([
    admin
      .from('customers')
      .select('id, quickbooks_customer_id')
      .eq('organization_id', organizationId)
      .not('quickbooks_customer_id', 'is', null),
    admin.from('jobs').select('id, customer_id, title').eq('organization_id', organizationId)
  ]);

  if (customerError) throw new Error(customerError.message);
  if (jobError) throw new Error(jobError.message);

  const customerByExternalId = new Map<string, string>();
  for (const customer of (customers || []) as CustomerMatch[]) {
    if (customer.quickbooks_customer_id) customerByExternalId.set(customer.quickbooks_customer_id, customer.id);
  }

  const jobsByCustomer = new Map<string, JobMatch[]>();
  for (const job of (jobs || []) as JobMatch[]) {
    if (!job.customer_id) continue;
    const list = jobsByCustomer.get(job.customer_id) || [];
    list.push(job);
    jobsByCustomer.set(job.customer_id, list);
  }

  return { customerByExternalId, jobsByCustomer };
}

function resolveJobId(jobs: JobMatch[], searchableText: string): string | null {
  if (jobs.length === 1) return jobs[0].id;
  const normalized = searchableText.toLowerCase();
  const matches = jobs.filter((job) => {
    const title = clean(job.title)?.toLowerCase();
    return Boolean(title && title.length >= 4 && normalized.includes(title));
  });
  return matches.length === 1 ? matches[0].id : null;
}

async function reconcileQuickBooksPayments(
  admin: SupabaseClient,
  organizationId: string,
  payments: QuickBooksPaymentEntity[]
): Promise<{ invoicesReconciled: number; unmatchedPayments: number }> {
  const totalsByInvoice = new Map<
    string,
    { amount: number; lastPaidAt: string | null; method: string | null; references: Set<string>; notes: Set<string> }
  >();

  for (const payment of payments) {
    const paymentTotal = Number(payment.TotalAmt || 0);
    const invoiceLinks = (payment.Line || []).flatMap((line) =>
      (line.LinkedTxn || [])
        .filter((link) => link.TxnType === 'Invoice' && clean(link.TxnId))
        .map((link) => ({ invoiceId: String(link.TxnId), amount: Number(line.Amount || 0) }))
    );

    for (const link of invoiceLinks) {
      const appliedAmount = link.amount > 0 ? link.amount : invoiceLinks.length === 1 ? paymentTotal : 0;
      if (!Number.isFinite(appliedAmount) || appliedAmount <= 0) continue;
      const existing = totalsByInvoice.get(link.invoiceId) || {
        amount: 0,
        lastPaidAt: null,
        method: null,
        references: new Set<string>(),
        notes: new Set<string>()
      };
      existing.amount += appliedAmount;
      const paidAt = clean(payment.TxnDate);
      if (paidAt && (!existing.lastPaidAt || paidAt > existing.lastPaidAt)) existing.lastPaidAt = paidAt;
      existing.method = clean(payment.PaymentMethodRef?.name) || existing.method;
      const reference = clean(payment.PaymentRefNum) || clean(payment.Id);
      if (reference) existing.references.add(reference);
      const note = clean(payment.PrivateNote);
      if (note) existing.notes.add(note);
      totalsByInvoice.set(link.invoiceId, existing);
    }
  }

  let invoicesReconciled = 0;
  let unmatchedPayments = 0;

  for (const [quickbooksInvoiceId, aggregate] of totalsByInvoice) {
    const { data: invoice, error } = await admin
      .from('invoices')
      .select('id, amount')
      .eq('organization_id', organizationId)
      .eq('quickbooks_invoice_id', quickbooksInvoiceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!invoice?.id) {
      unmatchedPayments += 1;
      continue;
    }

    const invoiceAmount = Math.max(0, Number(invoice.amount || 0));
    const amountPaid = Math.min(invoiceAmount, Math.max(0, aggregate.amount));
    const balanceDue = Math.max(0, invoiceAmount - amountPaid);
    const fullyPaid = invoiceAmount > 0 && balanceDue <= 0.005;
    const partiallyPaid = amountPaid > 0 && !fullyPaid;
    const paymentStatus = fullyPaid ? 'paid' : partiallyPaid ? 'partially_paid' : 'unpaid';

    const { error: updateError } = await admin
      .from('invoices')
      .update({
        amount_paid: amountPaid,
        balance_due: balanceDue,
        payment_status: paymentStatus,
        status: fullyPaid ? 'paid' : undefined,
        paid_at: fullyPaid ? aggregate.lastPaidAt : null,
        last_payment_at: aggregate.lastPaidAt,
        payment_method: aggregate.method,
        payment_reference: Array.from(aggregate.references).join(', ').slice(0, 500) || null,
        payment_notes: Array.from(aggregate.notes).join(' | ').slice(0, 2000) || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', invoice.id)
      .eq('organization_id', organizationId);
    if (updateError) throw new Error(updateError.message);
    invoicesReconciled += 1;
  }

  return { invoicesReconciled, unmatchedPayments };
}

export async function syncQuickBooksExpenses(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
  connection: QuickBooksConnectionRecord
): Promise<QuickBooksExpenseSyncResult> {
  const [purchases, bills, payments, matches] = await Promise.all([
    queryEntities<QuickBooksExpenseEntity>(admin, organizationId, connection, 'Purchase'),
    queryEntities<QuickBooksExpenseEntity>(admin, organizationId, connection, 'Bill'),
    queryEntities<QuickBooksPaymentEntity>(admin, organizationId, connection, 'Payment'),
    loadExpenseMatches(admin, organizationId)
  ]);

  const entities = [
    ...purchases.map((entity) => ({ entity, type: 'purchase' as const })),
    ...bills.map((entity) => ({ entity, type: 'bill' as const }))
  ];

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let customerMatches = 0;
  let jobMatches = 0;

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
    const description = descriptionFor(entity, type);
    const accountNames = accountNamesFor(entity);
    const quickBooksCustomerId = customerExternalIdFor(entity);
    const customerId = quickBooksCustomerId ? matches.customerByExternalId.get(quickBooksCustomerId) || null : null;
    const searchableText = [description, entity.PrivateNote, entity.DocNumber, vendor].filter(Boolean).join(' ');
    const jobId = customerId ? resolveJobId(matches.jobsByCustomer.get(customerId) || [], searchableText) : null;
    if (customerId) customerMatches += 1;
    if (jobId) jobMatches += 1;

    const notes = [
      clean(entity.PrivateNote),
      entity.DocNumber ? `QuickBooks document ${entity.DocNumber}` : null,
      accountNames.length ? `QuickBooks account: ${accountNames.join(', ')}` : null
    ]
      .filter(Boolean)
      .join(' | ') || null;

    const row = {
      organization_id: organizationId,
      job_id: jobId,
      customer_id: customerId,
      date,
      category: categoryFor(entity),
      vendor,
      description,
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

  const paymentResult = await reconcileQuickBooksPayments(admin, organizationId, payments);

  return {
    imported,
    updated,
    skipped,
    purchases: purchases.length,
    bills: bills.length,
    payments: payments.length,
    invoicesReconciled: paymentResult.invoicesReconciled,
    unmatchedPayments: paymentResult.unmatchedPayments,
    customerMatches,
    jobMatches
  };
}
