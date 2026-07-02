export type InvoicePaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

export type InvoicePaymentInput = {
  amount?: number | null;
  amount_paid?: number | null;
  due_date?: string | null;
  cancelled?: boolean;
  payment_status?: string | null;
};

export function calculateInvoicePaymentStatus(input: InvoicePaymentInput): InvoicePaymentStatus {
  if (input.cancelled || input.payment_status === 'cancelled') {
    return 'cancelled';
  }

  const amount = Math.max(0, Number(input.amount || 0));
  const paid = Math.max(0, Number(input.amount_paid || 0));

  if (amount > 0 && paid >= amount) {
    return 'paid';
  }
  if (paid > 0 && paid < amount) {
    if (input.due_date && amount > 0) {
      const due = new Date(`${input.due_date}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (due < today) {
        return 'overdue';
      }
    }
    return 'partially_paid';
  }

  if (input.due_date && amount > 0) {
    const due = new Date(`${input.due_date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (due < today) {
      return 'overdue';
    }
  }

  return 'unpaid';
}

export function calculateBalanceDue(amount: number | null | undefined, amountPaid: number | null | undefined): number {
  const total = Math.max(0, Number(amount || 0));
  const paid = Math.max(0, Number(amountPaid || 0));
  return Math.max(0, total - paid);
}

export function paymentStatusLabel(status: InvoicePaymentStatus | null | undefined): string {
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
  paymentStatus?: InvoicePaymentStatus | null;
  amount?: number | null;
  amountPaid?: number | null;
}): string {
  if (input.deliveryStatus === 'failed') {
    return 'Delivery failed';
  }
  if (input.paymentStatus === 'cancelled') {
    return 'Cancelled';
  }
  if (input.paymentStatus === 'paid') {
    return 'Paid';
  }
  if (input.paymentStatus === 'partially_paid') {
    return 'Partially paid';
  }
  if (input.paymentStatus === 'overdue') {
    return 'Overdue';
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

export function enrichOutboundDocumentPayment<T extends InvoicePaymentInput & {
  doc_type?: string;
  status?: string | null;
  amount_paid?: number | null;
  balance_due?: number | null;
  payment_status?: string | null;
  due_date?: string | null;
}>(doc: T): T & { payment_status: InvoicePaymentStatus; balance_due: number } {
  const amount = Math.max(0, Number(doc.amount || 0));
  const paid = Math.max(0, Number(doc.amount_paid || 0));
  const paymentStatus = calculateInvoicePaymentStatus({
    amount: amount || paid,
    amount_paid: paid,
    due_date: doc.due_date,
    cancelled: doc.payment_status === 'cancelled'
  });
  const balanceDue = calculateBalanceDue(amount || paid, paid);
  return {
    ...doc,
    payment_status: paymentStatus,
    balance_due: balanceDue
  };
}
