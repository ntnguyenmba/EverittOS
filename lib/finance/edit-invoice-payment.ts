/**
 * Edit or delete invoice_payments ledger rows and recompute invoice summaries.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { parseMoneyInput } from '@/lib/finance-format';
import {
  calculateBalanceDue,
  calculateInvoiceDocumentStatus,
  calculateInvoicePaymentStatus,
  type InvoicePaymentStatus
} from '@/lib/outbound/invoice-payment';

function parsePaidDate(value: string | null | undefined): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return new Date().toISOString().slice(0, 10);
}

function paidAtIso(paidDate: string): string {
  return `${paidDate}T12:00:00.000Z`;
}

const NON_RECONCILABLE = new Set(['cancelled', 'canceled', 'void', 'voided', 'deleted']);

function isNonReconciliable(paymentStatus: unknown, status: unknown): boolean {
  return (
    NON_RECONCILABLE.has(String(paymentStatus || '').toLowerCase()) ||
    NON_RECONCILABLE.has(String(status || '').toLowerCase())
  );
}

export async function reconcileInvoiceFromLedger(
  supabase: SupabaseClient,
  organizationId: string,
  invoiceId: string
): Promise<{
  amountPaid: number;
  balanceDue: number;
  paymentStatus: InvoicePaymentStatus;
  documentStatus: string;
  invoice: Record<string, unknown> | null;
}> {
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, amount, due_date, status, payment_status')
    .eq('id', invoiceId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (!invoice) {
    return {
      amountPaid: 0,
      balanceDue: 0,
      paymentStatus: 'unpaid',
      documentStatus: 'sent',
      invoice: null
    };
  }

  if (isNonReconciliable(invoice.payment_status, invoice.status)) {
    const amountPaid = Number(Math.max(0, Number((invoice as { amount_paid?: unknown }).amount_paid || 0)).toFixed(2));
    return {
      amountPaid,
      balanceDue: calculateBalanceDue(invoice.amount, amountPaid),
      paymentStatus: 'cancelled',
      documentStatus: String(invoice.status || 'cancelled'),
      invoice: invoice as Record<string, unknown>
    };
  }

  const { data: rows } = await supabase
    .from('invoice_payments')
    .select('amount, paid_at, payment_method, payment_reference')
    .eq('organization_id', organizationId)
    .eq('invoice_id', invoiceId)
    .gt('amount', 0)
    .order('paid_at', { ascending: false });

  const payments = rows || [];
  const amountPaid = Number(
    payments.reduce((sum, row) => sum + Math.max(0, Number(row.amount || 0)), 0).toFixed(2)
  );
  const invoiceAmount = Number(Math.max(0, Number(invoice.amount || 0)).toFixed(2));
  const balanceDue = calculateBalanceDue(invoiceAmount, amountPaid);
  const paymentStatus = calculateInvoicePaymentStatus({
    amount: invoiceAmount,
    amount_paid: amountPaid,
    due_date: (invoice.due_date as string | null) || null,
    payment_status: invoice.payment_status as string | null,
    status: invoice.status as string | null
  });
  const documentStatus = calculateInvoiceDocumentStatus({
    amount: invoiceAmount,
    amount_paid: amountPaid,
    due_date: (invoice.due_date as string | null) || null,
    payment_status: paymentStatus,
    status: invoice.status as string | null
  });
  const lastPayment = payments[0] || null;
  const lastPaidAt = lastPayment?.paid_at ? String(lastPayment.paid_at) : null;
  const hasPayments = payments.length > 0;

  const patch: Record<string, unknown> = {
    amount_paid: amountPaid,
    balance_due: balanceDue,
    payment_status: paymentStatus,
    status: documentStatus,
    last_payment_at: hasPayments ? lastPaidAt : null,
    payment_method: hasPayments ? lastPayment?.payment_method || null : null,
    payment_reference: hasPayments ? lastPayment?.payment_reference || null : null,
    paid_at: paymentStatus === 'paid' ? lastPaidAt : null,
    updated_at: new Date().toISOString()
  };

  const { data: updatedInvoice } = await supabase
    .from('invoices')
    .update(patch)
    .eq('id', invoiceId)
    .eq('organization_id', organizationId)
    .select('*')
    .single();

  await supabase
    .from('outbound_documents')
    .update(patch)
    .eq('organization_id', organizationId)
    .eq('doc_type', 'invoice')
    .eq('source_entity_id', invoiceId)
    .not('payment_status', 'in', '(cancelled,canceled,void,voided,deleted)')
    .not('status', 'in', '(cancelled,canceled,void,voided,deleted)');

  return {
    amountPaid,
    balanceDue,
    paymentStatus,
    documentStatus,
    invoice: (updatedInvoice as Record<string, unknown>) || null
  };
}

export async function updateInvoicePayment(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    paymentId: string;
    jobId?: string | null;
    amount?: number;
    paidDate?: string | null;
    paymentMethod?: string | null;
    paymentReference?: string | null;
    paymentNotes?: string | null;
    invoiceId?: string | null;
  }
): Promise<
  | {
      ok: true;
      invoiceId: string;
      previousInvoiceId: string | null;
      amountPaid: number;
      balanceDue: number;
      paymentStatus: InvoicePaymentStatus;
    }
  | { ok: false; error: string; status: number }
> {
  const { data: existing } = await supabase
    .from('invoice_payments')
    .select('id, invoice_id, organization_id')
    .eq('id', input.paymentId)
    .eq('organization_id', input.organizationId)
    .maybeSingle();

  if (!existing?.invoice_id) {
    return { ok: false, error: 'Payment not found.', status: 404 };
  }

  if (input.jobId) {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, job_id')
      .eq('id', existing.invoice_id)
      .eq('organization_id', input.organizationId)
      .maybeSingle();
    if (!invoice || String(invoice.job_id || '') !== input.jobId) {
      return { ok: false, error: 'Payment not found for this job.', status: 404 };
    }
  }

  const nextInvoiceId = input.invoiceId ? String(input.invoiceId) : String(existing.invoice_id);
  if (nextInvoiceId !== String(existing.invoice_id)) {
    const { data: targetInvoice } = await supabase
      .from('invoices')
      .select('id, organization_id')
      .eq('id', nextInvoiceId)
      .eq('organization_id', input.organizationId)
      .maybeSingle();
    if (!targetInvoice) {
      return { ok: false, error: 'Target invoice not found in this organization.', status: 400 };
    }
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.amount !== undefined) {
    const amount = parseMoneyInput(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: 'Enter a positive payment amount.', status: 400 };
    }
    update.amount = amount;
  }
  if (input.paidDate !== undefined) {
    update.paid_at = paidAtIso(parsePaidDate(input.paidDate));
  }
  if (input.paymentMethod !== undefined) update.payment_method = input.paymentMethod?.trim() || null;
  if (input.paymentReference !== undefined) update.payment_reference = input.paymentReference?.trim() || null;
  if (input.paymentNotes !== undefined) update.notes = input.paymentNotes?.trim() || null;
  if (input.invoiceId !== undefined) update.invoice_id = nextInvoiceId;

  const { error } = await supabase
    .from('invoice_payments')
    .update(update)
    .eq('id', input.paymentId)
    .eq('organization_id', input.organizationId);

  if (error) {
    return { ok: false, error: error.message || 'Unable to update payment.', status: 400 };
  }

  const reconciled = await reconcileInvoiceFromLedger(supabase, input.organizationId, nextInvoiceId);
  if (nextInvoiceId !== String(existing.invoice_id)) {
    await reconcileInvoiceFromLedger(supabase, input.organizationId, String(existing.invoice_id));
  }

  return {
    ok: true,
    invoiceId: nextInvoiceId,
    previousInvoiceId: nextInvoiceId !== String(existing.invoice_id) ? String(existing.invoice_id) : null,
    amountPaid: reconciled.amountPaid,
    balanceDue: reconciled.balanceDue,
    paymentStatus: reconciled.paymentStatus
  };
}

export async function deleteInvoicePayment(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    paymentId: string;
    jobId?: string | null;
  }
): Promise<
  | { ok: true; invoiceId: string; amountPaid: number; balanceDue: number; paymentStatus: InvoicePaymentStatus }
  | { ok: false; error: string; status: number }
> {
  const { data: existing } = await supabase
    .from('invoice_payments')
    .select('id, invoice_id')
    .eq('id', input.paymentId)
    .eq('organization_id', input.organizationId)
    .maybeSingle();

  if (!existing?.invoice_id) {
    return { ok: false, error: 'Payment not found.', status: 404 };
  }

  if (input.jobId) {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, job_id')
      .eq('id', existing.invoice_id)
      .eq('organization_id', input.organizationId)
      .maybeSingle();
    if (!invoice || String(invoice.job_id || '') !== input.jobId) {
      return { ok: false, error: 'Payment not found for this job.', status: 404 };
    }
  }

  const { error } = await supabase
    .from('invoice_payments')
    .delete()
    .eq('id', input.paymentId)
    .eq('organization_id', input.organizationId);

  if (error) {
    return { ok: false, error: error.message || 'Unable to delete payment.', status: 400 };
  }

  const reconciled = await reconcileInvoiceFromLedger(supabase, input.organizationId, String(existing.invoice_id));
  return {
    ok: true,
    invoiceId: String(existing.invoice_id),
    amountPaid: reconciled.amountPaid,
    balanceDue: reconciled.balanceDue,
    paymentStatus: reconciled.paymentStatus
  };
}
