export type InvoicePaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'cancelled';

/** Document/delivery status values used on invoices and outbound documents. */
export type InvoiceDocumentStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled' | string;

export type InvoicePaymentInput = {
  amount?: number | null;
  amount_paid?: number | null;
  due_date?: string | null;
  cancelled?: boolean;
  payment_status?: string | null;
  status?: string | null;
  today?: string | null;
};

function roundMoney(value: number): number {
  return Number(Math.max(0, value).toFixed(2));
}

function isPastDue(dueDate: string | null | undefined, todayIso?: string | null): boolean {
  if (!dueDate) return false;
  const due = String(dueDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return false;
  const today =
    todayIso && /^\d{4}-\d{2}-\d{2}$/.test(todayIso)
      ? todayIso
      : new Date().toISOString().slice(0, 10);
  return due < today;
}

/**
 * Payment state only. Overdue is never a payment_status.
 * Use calculateInvoiceDocumentStatus for sent/partial/paid/overdue.
 */
export function calculateInvoicePaymentStatus(input: InvoicePaymentInput): InvoicePaymentStatus {
  const statusHint = String(input.payment_status || input.status || '').toLowerCase();
  if (
    input.cancelled ||
    statusHint === 'cancelled' ||
    statusHint === 'canceled' ||
    statusHint === 'void' ||
    statusHint === 'voided' ||
    statusHint === 'deleted'
  ) {
    return 'cancelled';
  }

  const amount = roundMoney(Number(input.amount || 0));
  const paid = roundMoney(Number(input.amount_paid || 0));

  if (amount > 0 && paid >= amount) {
    return 'paid';
  }
  if (paid > 0) {
    return 'partially_paid';
  }
  return 'unpaid';
}

/**
 * Document status for invoices / outbound documents.
 * Overdue is represented here, never as payment_status.
 */
export function calculateInvoiceDocumentStatus(input: InvoicePaymentInput): InvoiceDocumentStatus {
  const paymentStatus = calculateInvoicePaymentStatus(input);
  if (paymentStatus === 'cancelled') return 'cancelled';
  if (paymentStatus === 'paid') return 'paid';

  const overdue = isPastDue(input.due_date, input.today);
  if (paymentStatus === 'partially_paid') {
    return overdue ? 'overdue' : 'partial';
  }

  if (overdue) return 'overdue';

  const current = String(input.status || '').toLowerCase();
  if (current === 'draft') return 'draft';
  if (current === 'paid' || current === 'partial' || current === 'overdue') return 'sent';
  return current || 'sent';
}

export function calculateBalanceDue(amount: number | null | undefined, amountPaid: number | null | undefined): number {
  return roundMoney(Number(amount || 0) - Number(amountPaid || 0));
}

export function paymentStatusLabel(status: InvoicePaymentStatus | 'overdue' | null | undefined): string {
  switch (status) {
    case 'paid':
      return 'Paid';
    case 'partially_paid':
      return 'Partially paid';
    case 'overdue':
      return 'Overdue';
    case 'cancelled':
      return 'Cancelled';
    case 'unpaid':
    default:
      return 'Unpaid';
  }
}

export function invoiceDeliveryPaymentLabel(input: {
  deliveryStatus?: string | null;
  paymentStatus?: InvoicePaymentStatus | 'overdue' | null;
  documentStatus?: string | null;
  amount?: number | null;
  amountPaid?: number | null;
}): string {
  if (input.deliveryStatus === 'failed') {
    return 'Delivery failed';
  }
  if (input.paymentStatus === 'cancelled' || input.documentStatus === 'cancelled') {
    return 'Cancelled';
  }
  if (input.paymentStatus === 'paid' || input.documentStatus === 'paid') {
    return 'Paid';
  }
  if (input.documentStatus === 'overdue' || input.paymentStatus === 'overdue') {
    return 'Overdue';
  }
  if (input.paymentStatus === 'partially_paid') {
    return 'Partially paid';
  }
  if (input.deliveryStatus === 'sent' || input.deliveryStatus === 'scheduled') {
    const paid = Number(input.amountPaid || 0);
    if (paid <= 0) {
      return 'Invoice sent, payment not recorded';
    }
  }
  return paymentStatusLabel(input.paymentStatus);
}

export const INVOICE_PAYMENT_METHODS = ['Cash', 'Check', 'Card', 'ACH', 'Zelle', 'Venmo', 'Other'] as const;

export function enrichOutboundDocumentPayment<
  T extends InvoicePaymentInput & {
    doc_type?: string;
    status?: string | null;
    amount_paid?: number | null;
    balance_due?: number | null;
    payment_status?: string | null;
    due_date?: string | null;
  }
>(doc: T): T & { payment_status: InvoicePaymentStatus; balance_due: number; status: string } {
  const amount = roundMoney(Number(doc.amount || 0));
  const paid = roundMoney(Number(doc.amount_paid || 0));
  const paymentStatus = calculateInvoicePaymentStatus({
    amount: amount || paid,
    amount_paid: paid,
    due_date: doc.due_date,
    cancelled: doc.payment_status === 'cancelled',
    payment_status: doc.payment_status,
    status: doc.status
  });
  const documentStatus = calculateInvoiceDocumentStatus({
    amount: amount || paid,
    amount_paid: paid,
    due_date: doc.due_date,
    cancelled: paymentStatus === 'cancelled',
    payment_status: paymentStatus,
    status: doc.status
  });
  const balanceDue = calculateBalanceDue(amount || paid, paid);
  return {
    ...doc,
    payment_status: paymentStatus,
    status: documentStatus,
    balance_due: balanceDue
  };
}
