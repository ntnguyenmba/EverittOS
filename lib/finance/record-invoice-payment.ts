/**
 * Canonical customer payment recorder.
 *
 * ONE write path for every customer payment:
 * 1. Update invoice summary fields (amount_paid, balance_due, payment_status)
 * 2. Sync linked outbound_documents summary fields
 * 3. Insert an invoice_payments ledger row (required for cash reporting)
 *
 * All UI and API entry points must call these helpers for new payments.
 * Partial payments create multiple ledger rows. Corrections use edit-invoice-payment helpers.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calculateBalanceDue,
  calculateInvoiceDocumentStatus,
  calculateInvoicePaymentStatus,
  type InvoicePaymentStatus
} from '@/lib/outbound/invoice-payment';

export type RecordPaymentInput = {
  organizationId: string;
  userId: string;
  amount?: number;
  paidDate?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  paymentNotes?: string | null;
  /** Mark invoice cancelled without inserting a payment row. */
  cancel?: boolean;
};

export type RecordPaymentResult =
  | {
      ok: true;
      invoiceId: string | null;
      outboundDocumentId: string | null;
      amountPaid: number;
      balanceDue: number;
      paymentStatus: InvoicePaymentStatus;
      paymentIncrement: number;
      invoice: Record<string, unknown> | null;
      document: Record<string, unknown> | null;
    }
  | { ok: false; error: string; status: number };

function parsePaidDate(value: string | null | undefined): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return new Date().toISOString().slice(0, 10);
}

function paidAtIso(paidDate: string): string {
  return `${paidDate}T12:00:00.000Z`;
}

function buildSummaryPatch(input: {
  invoiceAmount: number;
  existingPaid: number;
  paymentAmount: number;
  dueDate: string | null;
  cancel: boolean;
  paidDate: string;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  paymentNotes?: string | null;
  priorNotes?: string | null;
  priorMethod?: string | null;
  priorReference?: string | null;
  priorLastPaymentAt?: string | null;
  priorStatus?: string | null;
}): {
  amountPaid: number;
  balanceDue: number;
  paymentStatus: InvoicePaymentStatus;
  paymentIncrement: number;
  patch: Record<string, unknown>;
} {
  const now = new Date().toISOString();

  if (input.cancel) {
    return {
      amountPaid: input.existingPaid,
      balanceDue: calculateBalanceDue(input.invoiceAmount || input.existingPaid, input.existingPaid),
      paymentStatus: 'cancelled',
      paymentIncrement: 0,
      patch: {
        payment_status: 'cancelled',
        status: 'cancelled',
        updated_at: now
      }
    };
  }

  const nextPaid =
    input.invoiceAmount > 0
      ? Math.min(input.existingPaid + input.paymentAmount, input.invoiceAmount)
      : input.existingPaid + input.paymentAmount;
  const paymentIncrement = Math.max(0, nextPaid - input.existingPaid);
  const paymentStatus = calculateInvoicePaymentStatus({
    amount: input.invoiceAmount || nextPaid,
    amount_paid: nextPaid,
    due_date: input.dueDate,
    cancelled: false
  });
  const documentStatus = calculateInvoiceDocumentStatus({
    amount: input.invoiceAmount || nextPaid,
    amount_paid: nextPaid,
    due_date: input.dueDate,
    payment_status: paymentStatus,
    status: input.priorStatus
  });
  const balanceDue = calculateBalanceDue(input.invoiceAmount || nextPaid, nextPaid);

  const patch: Record<string, unknown> = {
    amount_paid: nextPaid,
    balance_due: balanceDue,
    payment_status: paymentStatus,
    status: documentStatus,
    last_payment_at: paidAtIso(input.paidDate),
    payment_method: input.paymentMethod?.trim() || input.priorMethod || null,
    payment_reference: input.paymentReference?.trim() || input.priorReference || null,
    updated_at: now
  };

  const note = input.paymentNotes?.trim();
  if (note) {
    const prior = typeof input.priorNotes === 'string' ? input.priorNotes : '';
    patch.payment_notes = prior ? `${prior}\n${note}` : note;
  }

  if (paymentStatus === 'paid') {
    patch.paid_at = paidAtIso(input.paidDate);
  } else {
    patch.paid_at = null;
  }

  return { amountPaid: nextPaid, balanceDue, paymentStatus, paymentIncrement, patch };
}

async function insertLedgerRow(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    invoiceId: string;
    outboundDocumentId: string | null;
    amount: number;
    paidAt: string;
    paymentMethod: string | null;
    paymentReference: string | null;
    notes: string | null;
    userId: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from('invoice_payments').insert({
    organization_id: input.organizationId,
    invoice_id: input.invoiceId,
    outbound_document_id: input.outboundDocumentId,
    amount: input.amount,
    paid_at: input.paidAt,
    payment_method: input.paymentMethod,
    payment_reference: input.paymentReference,
    notes: input.notes,
    source: 'recorded',
    created_by: input.userId
  });
  if (error) {
    return { ok: false, error: error.message || 'Unable to record payment ledger entry.' };
  }
  return { ok: true };
}

async function syncOutboundForInvoice(
  supabase: SupabaseClient,
  organizationId: string,
  invoiceId: string,
  patch: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from('outbound_documents')
    .update(patch)
    .eq('organization_id', organizationId)
    .eq('source_entity_id', invoiceId)
    .eq('doc_type', 'invoice')
    .select('*');
  return (data && data[0]) || null;
}

async function syncInvoice(
  supabase: SupabaseClient,
  organizationId: string,
  invoiceId: string,
  patch: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('invoices')
    .update(patch)
    .eq('id', invoiceId)
    .eq('organization_id', organizationId)
    .select('*')
    .single();
  if (error) return null;
  return data as Record<string, unknown>;
}

/** Record a payment against an invoices.id row (and sync outbound docs). */
export async function recordInvoicePaymentByInvoiceId(
  supabase: SupabaseClient,
  invoiceId: string,
  input: RecordPaymentInput
): Promise<RecordPaymentResult> {
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('organization_id', input.organizationId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message, status: 400 };
  if (!invoice) return { ok: false, error: 'Invoice not found.', status: 404 };

  if (!input.cancel) {
    const paymentAmount = Number(input.amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return { ok: false, error: 'Enter a positive payment amount.', status: 400 };
    }
  }

  const paidDate = parsePaidDate(input.paidDate);
  const summary = buildSummaryPatch({
    invoiceAmount: Math.max(0, Number(invoice.amount || 0)),
    existingPaid: Math.max(0, Number(invoice.amount_paid || 0)),
    paymentAmount: Number(input.amount || 0),
    dueDate: (invoice.due_date as string | null) || null,
    cancel: Boolean(input.cancel),
    paidDate,
    paymentMethod: input.paymentMethod,
    paymentReference: input.paymentReference,
    paymentNotes: input.paymentNotes,
    priorNotes: (invoice.payment_notes as string | null) || null,
    priorMethod: (invoice.payment_method as string | null) || null,
    priorReference: (invoice.payment_reference as string | null) || null,
    priorLastPaymentAt: (invoice.last_payment_at as string | null) || null,
    priorStatus: (invoice.status as string | null) || null
  });

  const updatedInvoice = await syncInvoice(supabase, input.organizationId, invoiceId, summary.patch);
  if (!updatedInvoice) {
    return { ok: false, error: 'Unable to update invoice.', status: 400 };
  }

  const updatedDocument = await syncOutboundForInvoice(
    supabase,
    input.organizationId,
    invoiceId,
    summary.patch
  );

  if (!input.cancel && summary.paymentIncrement > 0) {
    const ledger = await insertLedgerRow(supabase, {
      organizationId: input.organizationId,
      invoiceId,
      outboundDocumentId: updatedDocument ? String(updatedDocument.id) : null,
      amount: summary.paymentIncrement,
      paidAt: paidAtIso(paidDate),
      paymentMethod: (summary.patch.payment_method as string | null) || null,
      paymentReference: (summary.patch.payment_reference as string | null) || null,
      notes: input.paymentNotes?.trim() || null,
      userId: input.userId
    });
    if (!ledger.ok) {
      return { ok: false, error: ledger.error, status: 400 };
    }
  }

  return {
    ok: true,
    invoiceId,
    outboundDocumentId: updatedDocument ? String(updatedDocument.id) : null,
    amountPaid: summary.amountPaid,
    balanceDue: summary.balanceDue,
    paymentStatus: summary.paymentStatus,
    paymentIncrement: summary.paymentIncrement,
    invoice: updatedInvoice,
    document: updatedDocument
  };
}

/** Record a payment against an outbound_documents.id invoice row. */
export async function recordInvoicePaymentByOutboundId(
  supabase: SupabaseClient,
  outboundDocumentId: string,
  input: RecordPaymentInput
): Promise<RecordPaymentResult> {
  const { data: document, error } = await supabase
    .from('outbound_documents')
    .select('*')
    .eq('id', outboundDocumentId)
    .eq('organization_id', input.organizationId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message, status: 400 };
  if (!document) return { ok: false, error: 'Invoice not found.', status: 404 };
  if (document.doc_type !== 'invoice') {
    return { ok: false, error: 'Payment recording is only available for invoices.', status: 400 };
  }

  if (!input.cancel) {
    const paymentAmount = Number(input.amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return { ok: false, error: 'Enter a positive payment amount.', status: 400 };
    }
  }

  const paidDate = parsePaidDate(input.paidDate);
  const invoiceId = document.source_entity_id ? String(document.source_entity_id) : null;

  // Prefer invoice row balances when linked so outbound and invoices stay aligned.
  let invoiceAmount = Math.max(0, Number(document.amount || 0));
  let existingPaid = Math.max(0, Number(document.amount_paid || 0));
  let dueDate = (document.due_date as string | null) || null;
  let priorNotes = (document.payment_notes as string | null) || null;
  let priorMethod = (document.payment_method as string | null) || null;
  let priorReference = (document.payment_reference as string | null) || null;
  let priorStatus = (document.status as string | null) || null;

  if (invoiceId) {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('amount, amount_paid, due_date, payment_notes, payment_method, payment_reference, status')
      .eq('id', invoiceId)
      .eq('organization_id', input.organizationId)
      .maybeSingle();
    if (invoice) {
      invoiceAmount = Math.max(0, Number(invoice.amount || 0));
      existingPaid = Math.max(0, Number(invoice.amount_paid || 0));
      dueDate = (invoice.due_date as string | null) || dueDate;
      priorNotes = (invoice.payment_notes as string | null) || priorNotes;
      priorMethod = (invoice.payment_method as string | null) || priorMethod;
      priorReference = (invoice.payment_reference as string | null) || priorReference;
      priorStatus = (invoice.status as string | null) || priorStatus;
    }
  }

  const summary = buildSummaryPatch({
    invoiceAmount,
    existingPaid,
    paymentAmount: Number(input.amount || 0),
    dueDate,
    cancel: Boolean(input.cancel),
    paidDate,
    paymentMethod: input.paymentMethod,
    paymentReference: input.paymentReference,
    paymentNotes: input.paymentNotes,
    priorNotes,
    priorMethod,
    priorReference,
    priorStatus
  });

  const { data: updatedDocument, error: updateError } = await supabase
    .from('outbound_documents')
    .update(summary.patch)
    .eq('id', outboundDocumentId)
    .eq('organization_id', input.organizationId)
    .select('*')
    .single();

  if (updateError) return { ok: false, error: updateError.message, status: 400 };

  let updatedInvoice: Record<string, unknown> | null = null;
  if (invoiceId) {
    updatedInvoice = await syncInvoice(supabase, input.organizationId, invoiceId, summary.patch);
    if (!input.cancel && summary.paymentIncrement > 0) {
      const ledger = await insertLedgerRow(supabase, {
        organizationId: input.organizationId,
        invoiceId,
        outboundDocumentId,
        amount: summary.paymentIncrement,
        paidAt: paidAtIso(paidDate),
        paymentMethod: (summary.patch.payment_method as string | null) || null,
        paymentReference: (summary.patch.payment_reference as string | null) || null,
        notes: input.paymentNotes?.trim() || null,
        userId: input.userId
      });
      if (!ledger.ok) {
        return { ok: false, error: ledger.error, status: 400 };
      }
    }
  }

  return {
    ok: true,
    invoiceId,
    outboundDocumentId,
    amountPaid: summary.amountPaid,
    balanceDue: summary.balanceDue,
    paymentStatus: summary.paymentStatus,
    paymentIncrement: summary.paymentIncrement,
    invoice: updatedInvoice,
    document: updatedDocument as Record<string, unknown>
  };
}

/**
 * When a legacy client patches amount_paid upward, convert the delta into a
 * canonical ledger payment so dashboards stay consistent.
 */
export async function recordPaymentDeltaFromAmountPaid(
  supabase: SupabaseClient,
  invoiceId: string,
  input: {
    organizationId: string;
    userId: string;
    previousPaid: number;
    nextPaid: number;
    paidDate?: string | null;
    paymentMethod?: string | null;
    paymentReference?: string | null;
    paymentNotes?: string | null;
  }
): Promise<RecordPaymentResult | null> {
  const increment = Math.max(0, Number(input.nextPaid) - Number(input.previousPaid));
  if (increment <= 0) return null;
  return recordInvoicePaymentByInvoiceId(supabase, invoiceId, {
    organizationId: input.organizationId,
    userId: input.userId,
    amount: increment,
    paidDate: input.paidDate,
    paymentMethod: input.paymentMethod,
    paymentReference: input.paymentReference,
    paymentNotes: input.paymentNotes || 'Recorded via invoice update'
  });
}
