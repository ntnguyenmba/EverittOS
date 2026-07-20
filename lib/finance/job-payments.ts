/**
 * Direct job payments and shared client payment helpers.
 * Invoice-linked cash stays in invoice_payments; direct job cash uses job_payments.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { recordInvoicePaymentByInvoiceId } from '@/lib/finance/record-invoice-payment';
import { parseMoneyInput } from '@/lib/finance-format';

export const CLIENT_PAYMENT_METHODS = [
  'Cash',
  'Check',
  'ACH / Bank Transfer',
  'Zelle',
  'Venmo',
  'Credit Card',
  'Debit Card',
  'Stripe',
  'Square',
  'Property Management Portal',
  'Other'
] as const;

export type ClientPaymentMethod = (typeof CLIENT_PAYMENT_METHODS)[number];

export type JobPaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'no_amount_set';

export type JobPaymentRow = {
  id: string;
  organization_id: string;
  job_id: string;
  customer_id: string | null;
  invoice_id: string | null;
  amount: number;
  paid_at: string;
  payment_method: string | null;
  payment_reference: string | null;
  notes: string | null;
  source: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type JobPaymentHistoryItem = {
  id: string;
  source: 'job' | 'invoice';
  amount: number;
  paidAt: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  notes: string | null;
  invoiceId: string | null;
  createdBy: string | null;
};

export type RecordJobPaymentInput = {
  organizationId: string;
  userId: string;
  jobId: string;
  customerId?: string | null;
  amount: number;
  paidDate?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  paymentNotes?: string | null;
};

function parsePaidDate(value: string | null | undefined): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return new Date().toISOString().slice(0, 10);
}

function paidAtIso(paidDate: string): string {
  return `${paidDate}T12:00:00.000Z`;
}

export function calculateJobPaymentStatus(
  expectedAmount: number,
  collectedAmount: number
): JobPaymentStatus {
  const expected = Math.max(0, Number(expectedAmount));
  const collected = Math.max(0, Number(collectedAmount));

  if (expected <= 0) return 'no_amount_set';
  if (collected <= 0) return 'unpaid';
  if (collected + 0.009 < expected) return 'partially_paid';
  return 'paid';
}

export function calculateOutstandingBalance(expectedAmount: number, collectedAmount: number): number {
  return Math.max(0, Number(expectedAmount || 0) - Math.max(0, Number(collectedAmount || 0)));
}

export function resolveExpectedJobAmount(input: {
  manualRevenue: number;
  invoiceTotal: number;
  hasInvoice: boolean;
}): number {
  if (input.hasInvoice && input.invoiceTotal > 0) return input.invoiceTotal;
  return Math.max(0, input.manualRevenue);
}

export async function fetchJobPaymentHistory(
  supabase: SupabaseClient,
  organizationId: string,
  jobId: string
): Promise<{ payments: JobPaymentHistoryItem[]; error: string | null }> {
  const [directRes, invoiceRes] = await Promise.all([
    supabase
      .from('job_payments')
      .select('id, amount, paid_at, payment_method, payment_reference, notes, invoice_id, created_by')
      .eq('organization_id', organizationId)
      .eq('job_id', jobId)
      .order('paid_at', { ascending: false }),
    supabase
      .from('invoices')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('job_id', jobId)
  ]);

  if (directRes.error) {
    return { payments: [], error: directRes.error.message };
  }

  const invoiceIds = (invoiceRes.data || []).map((row) => String(row.id)).filter(Boolean);
  let invoicePayments: JobPaymentHistoryItem[] = [];

  if (invoiceIds.length) {
    const ledgerRes = await supabase
      .from('invoice_payments')
      .select('id, invoice_id, amount, paid_at, payment_method, payment_reference, notes, created_by')
      .eq('organization_id', organizationId)
      .in('invoice_id', invoiceIds)
      .order('paid_at', { ascending: false });

    if (ledgerRes.error && !ledgerRes.error.message.includes('invoice_payments')) {
      return { payments: [], error: ledgerRes.error.message };
    }

    invoicePayments = (ledgerRes.data || []).map((row) => ({
      id: String(row.id),
      source: 'invoice' as const,
      amount: Number(row.amount || 0),
      paidAt: String(row.paid_at || ''),
      paymentMethod: (row.payment_method as string | null) || null,
      paymentReference: (row.payment_reference as string | null) || null,
      notes: (row.notes as string | null) || null,
      invoiceId: String(row.invoice_id || ''),
      createdBy: (row.created_by as string | null) || null
    }));
  }

  const directPayments: JobPaymentHistoryItem[] = (directRes.data || []).map((row) => ({
    id: String(row.id),
    source: 'job' as const,
    amount: Number(row.amount || 0),
    paidAt: String(row.paid_at || ''),
    paymentMethod: (row.payment_method as string | null) || null,
    paymentReference: (row.payment_reference as string | null) || null,
    notes: (row.notes as string | null) || null,
    invoiceId: (row.invoice_id as string | null) || null,
    createdBy: (row.created_by as string | null) || null
  }));

  const payments = [...directPayments, ...invoicePayments].sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
  );

  return { payments, error: null };
}

export async function sumJobCollectedPayments(
  supabase: SupabaseClient,
  organizationId: string,
  jobId: string
): Promise<number> {
  const { payments } = await fetchJobPaymentHistory(supabase, organizationId, jobId);
  return Number(payments.reduce((sum, row) => sum + row.amount, 0).toFixed(2));
}

export async function recordJobPayment(
  supabase: SupabaseClient,
  input: RecordJobPaymentInput
): Promise<
  | { ok: true; payment: JobPaymentRow | null; viaInvoice: boolean; invoiceId: string | null }
  | { ok: false; error: string; status: number }
> {
  const amount = parseMoneyInput(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Enter a positive payment amount.', status: 400 };
  }

  const paidDate = parsePaidDate(input.paidDate);
  const paidAt = paidAtIso(paidDate);

  const { data: job } = await supabase
    .from('jobs')
    .select('id, customer_id')
    .eq('id', input.jobId)
    .eq('organization_id', input.organizationId)
    .maybeSingle();

  if (!job) {
    return { ok: false, error: 'Job not found.', status: 404 };
  }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id')
    .eq('organization_id', input.organizationId)
    .eq('job_id', input.jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (invoice?.id) {
    const result = await recordInvoicePaymentByInvoiceId(supabase, String(invoice.id), {
      organizationId: input.organizationId,
      userId: input.userId,
      amount,
      paidDate,
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference,
      paymentNotes: input.paymentNotes
    });

    if (!result.ok) {
      return { ok: false, error: result.error, status: result.status };
    }

    return { ok: true, payment: null, viaInvoice: true, invoiceId: String(invoice.id) };
  }

  const { data: payment, error } = await supabase
    .from('job_payments')
    .insert({
      organization_id: input.organizationId,
      job_id: input.jobId,
      customer_id: input.customerId ?? job.customer_id ?? null,
      invoice_id: null,
      amount,
      paid_at: paidAt,
      payment_method: input.paymentMethod?.trim() || null,
      payment_reference: input.paymentReference?.trim() || null,
      notes: input.paymentNotes?.trim() || null,
      source: 'recorded',
      created_by: input.userId
    })
    .select('*')
    .single();

  if (error) {
    return { ok: false, error: error.message || 'Unable to record payment.', status: 400 };
  }

  return {
    ok: true,
    payment: payment as JobPaymentRow,
    viaInvoice: false,
    invoiceId: null
  };
}

export async function deleteJobPayment(
  supabase: SupabaseClient,
  organizationId: string,
  jobId: string,
  paymentId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data, error } = await supabase
    .from('job_payments')
    .delete()
    .eq('id', paymentId)
    .eq('job_id', jobId)
    .eq('organization_id', organizationId)
    .select('id')
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message, status: 400 };
  }
  if (!data) {
    return { ok: false, error: 'Payment not found.', status: 404 };
  }
  return { ok: true };
}

export async function updateJobPayment(
  supabase: SupabaseClient,
  organizationId: string,
  jobId: string,
  paymentId: string,
  patch: {
    amount?: number;
    paidDate?: string | null;
    paymentMethod?: string | null;
    paymentReference?: string | null;
    paymentNotes?: string | null;
  }
): Promise<{ ok: true; payment: JobPaymentRow } | { ok: false; error: string; status: number }> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (patch.amount !== undefined) {
    const amount = parseMoneyInput(patch.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: 'Enter a positive payment amount.', status: 400 };
    }
    update.amount = amount;
  }
  if (patch.paidDate !== undefined) {
    update.paid_at = paidAtIso(parsePaidDate(patch.paidDate));
  }
  if (patch.paymentMethod !== undefined) update.payment_method = patch.paymentMethod?.trim() || null;
  if (patch.paymentReference !== undefined) update.payment_reference = patch.paymentReference?.trim() || null;
  if (patch.paymentNotes !== undefined) update.notes = patch.paymentNotes?.trim() || null;

  const { data, error } = await supabase
    .from('job_payments')
    .update(update)
    .eq('id', paymentId)
    .eq('job_id', jobId)
    .eq('organization_id', organizationId)
    .select('*')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message || 'Payment not found.', status: 404 };
  }

  return { ok: true, payment: data as JobPaymentRow };
}
