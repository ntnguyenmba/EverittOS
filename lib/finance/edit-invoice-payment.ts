/**
 * Edit or delete invoice_payments ledger rows and recompute invoice summaries.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { parseMoneyInput } from '@/lib/finance-format';
import {
  calculateBalanceDue,
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

export async function reconcileInvoiceFromLedger(
  supabase: SupabaseClient,
  organizationId: string,
  invoiceId: string
): Promise<{
  amountPaid: number;
  balanceDue: number;
  paymentStatus: InvoicePaymentStatus;
  invoice: Record<string, unknown> | null;
}> {
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, amount, due_date, status, payment_status, payment_method, payment_reference')
    .eq('id', invoiceId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (!invoice) {
    return { amountPaid: 0, balanceDue: 0, paymentStatus: 'unpaid', invoice: null };
  }

  const statusHint = String(invoice.payment_status || invoice.status || '').toLowerCase();
  if (statusHint === 'cancelled' || statusHint === 'canceled') {
    return {
      amountPaid: 0,
      balanceDue: calculateBalanceDue(invoice.amount, 0),
      paymentStatus: 'cancelled',
      invoice: invoice as Record<string, unknown>
    };
  }

  const { data: rows } = await supabase
    .from('invoice_payments')
    .select('amount, paid_at, payment_method, payment_reference')
    .eq('organization_id', organizationId)
    .eq('invoice_id', invoiceId)
    .order('paid_at', { ascending: false });

  const payments = rows || [];
  const amountPaid = Number(
    payments.reduce((sum, row) => sum + Math.max(0, Number(row.amount || 0)), 0).toFixed(2)
  );
  const invoiceAmount = Math.max(0, Number(invoice.amount || 0));
  const balanceDue = calculateBalanceDue(invoiceAmount, amountPaid);
  const paymentStatus = calculateInvoicePaymentStatus({
    amount: invoiceAmount,
    amount_paid: amountPaid,
    due_date: (invoice.due_date as string | null) || null
  });
  const lastPayment = payments[0];
  const lastPaidAt = lastPayment?.paid_at ? String(lastPayment.paid_at) : null;

  const patch: Record<string, unknown> = {
    amount_paid: amountPaid,
    balance_due: balanceDue,
    payment_status: paymentStatus,
    last_payment_at: lastPaidAt,
    payment_method: lastPayment?.payment_method || invoice.payment_method || null,
    payment_reference: lastPayment?.payment_reference || invoice.payment_reference || null,
    updated_at: new Date().toISOString(),
    status:
      paymentStatus === 'paid'
        ? 'paid'
        : paymentStatus === 'partially_paid' || paymentStatus === 'overdue'
          ? 'partial'
          : 'sent',
    paid_at: paymentStatus === 'paid' ? lastPaidAt : null
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
    .eq('source_entity_id', invoiceId);

  return {
    amountPaid,
    balanceDue,
    paymentStatus,
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
  }
): Promise<
  | { ok: true; invoiceId: string; amountPaid: number; balanceDue: number; paymentStatus: InvoicePaymentStatus }
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

  const { error } = await supabase
    .from('invoice_payments')
    .update(update)
    .eq('id', input.paymentId)
    .eq('organization_id', input.organizationId);

  if (error) {
    return { ok: false, error: error.message || 'Unable to update payment.', status: 400 };
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
