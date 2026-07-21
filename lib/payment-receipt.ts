import { customerDisplayAddress, customerDisplayName, type CustomerRecord } from '@/lib/customer-record';
import { formatCurrency } from '@/lib/finance-format';

export type ReceiptCustomerSource = {
  company_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  service_address?: string | null;
  property_address?: string | null;
};

export type ReceiptJobSource = {
  title?: string | null;
  customer_name?: string | null;
  phone?: string | null;
  address?: string | null;
};

export type ReceiptPaymentSource = {
  id: string;
  amount: number;
  paidAt: string;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  notes?: string | null;
  source: 'job' | 'invoice';
};

export type ReceiptBusinessSource = {
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
};

export type ReceiptDetailRow = {
  label: string;
  value: string;
};

export type PaymentReceiptView = {
  receiptNumber: string;
  paidOnLabel: string;
  amountPaidLabel: string;
  amountPaidValue: string;
  businessName: string | null;
  businessLines: string[];
  customerHeading: string;
  customerLines: string[];
  receiptDetails: ReceiptDetailRow[];
  thankYou: string;
  keepCopy: string;
  paidInFull: boolean;
};

function trimText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function formatReceiptPaidOn(value: string, locale = 'en-US'): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    const fallback = String(value || '').slice(0, 10);
    return fallback ? `Paid on ${fallback}.` : 'Paid on an unknown date.';
  }

  const formatted = new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);

  return `Paid on ${formatted}.`;
}

export function buildReceiptNumber(paymentId: string): string {
  return `RCPT-${String(paymentId).slice(0, 8).toUpperCase()}`;
}

function formatStructuredAddress(customer: ReceiptCustomerSource | null | undefined): string[] {
  if (!customer) return [];

  const dedicated =
    trimText(customer.service_address) || trimText(customer.property_address) || null;
  if (dedicated) return [dedicated];

  const street = [trimText(customer.address_line1), trimText(customer.address_line2)].filter(
    (part): part is string => Boolean(part)
  );
  const cityStateZip = [
    trimText(customer.city),
    [trimText(customer.state), trimText(customer.postal_code)].filter(Boolean).join(' ')
  ]
    .filter(Boolean)
    .join(', ');

  const lines = [...street];
  if (cityStateZip) lines.push(cityStateZip);
  const country = trimText(customer.country);
  if (country) lines.push(country);
  return lines;
}

export function resolveReceiptCustomer(input: {
  linkedCustomer?: ReceiptCustomerSource | null;
  job?: ReceiptJobSource | null;
}): {
  displayName: string | null;
  email: string | null;
  phone: string | null;
  addressLines: string[];
} {
  const linked = input.linkedCustomer || null;
  const job = input.job || null;

  const linkedAsRecord = linked as Partial<CustomerRecord> | null;
  const linkedName = linked
    ? customerDisplayName(linkedAsRecord, '') || trimText(linked.name)
    : null;

  const structured = formatStructuredAddress(linked);
  const linkedAddressFallback =
    structured.length === 0
      ? customerDisplayAddress(linkedAsRecord, '') || trimText(linked?.address)
      : null;

  const displayName = linkedName || trimText(job?.customer_name) || null;
  const email = trimText(linked?.email) || null;
  const phone = trimText(linked?.phone) || trimText(job?.phone) || null;
  const addressLines =
    structured.length > 0
      ? structured
      : linkedAddressFallback
        ? [linkedAddressFallback]
        : trimText(job?.address)
          ? [String(trimText(job?.address))]
          : [];

  return { displayName, email, phone, addressLines };
}

export function buildReceiptDetailRows(input: {
  serviceTitle: string;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  outstanding: number;
  includePaymentDate?: boolean;
  paidAt?: string;
}): ReceiptDetailRow[] {
  const rows: ReceiptDetailRow[] = [
    { label: 'Service', value: input.serviceTitle || 'Service' }
  ];

  if (input.includePaymentDate && input.paidAt) {
    rows.push({
      label: 'Payment date',
      value: formatReceiptPaidOn(input.paidAt).replace(/^Paid on\s+/i, '').replace(/\.$/, '')
    });
  }

  const method = trimText(input.paymentMethod);
  if (method) {
    rows.push({ label: 'Payment method', value: method });
  }

  const reference = trimText(input.paymentReference);
  if (reference) {
    rows.push({ label: 'Reference', value: reference });
  }

  const outstanding = Math.max(0, Number(input.outstanding || 0));
  if (outstanding > 0) {
    rows.push({ label: 'Remaining balance', value: formatCurrency(outstanding) });
  }

  return rows;
}

export function buildPaymentReceiptView(input: {
  payment: ReceiptPaymentSource;
  job?: ReceiptJobSource | null;
  linkedCustomer?: ReceiptCustomerSource | null;
  business?: ReceiptBusinessSource | null;
  outstanding: number;
  locale?: string;
}): PaymentReceiptView {
  const customer = resolveReceiptCustomer({
    linkedCustomer: input.linkedCustomer,
    job: input.job
  });

  const customerLines = [
    customer.displayName,
    customer.email,
    customer.phone,
    ...customer.addressLines
  ].filter((line): line is string => Boolean(line));

  const businessLines = [
    trimText(input.business?.phone),
    trimText(input.business?.email),
    trimText(input.business?.website),
    trimText(input.business?.address)
  ].filter((line): line is string => Boolean(line));

  const outstanding = Math.max(0, Number(input.outstanding || 0));
  const paidInFull = outstanding <= 0;

  return {
    receiptNumber: buildReceiptNumber(input.payment.id),
    paidOnLabel: formatReceiptPaidOn(input.payment.paidAt, input.locale || 'en-US'),
    amountPaidLabel: 'Amount paid',
    amountPaidValue: formatCurrency(input.payment.amount),
    businessName: trimText(input.business?.companyName),
    businessLines,
    customerHeading: 'Customer details',
    customerLines: customerLines.length ? customerLines : ['Customer'],
    receiptDetails: buildReceiptDetailRows({
      serviceTitle: trimText(input.job?.title) || 'Service',
      paymentMethod: input.payment.paymentMethod,
      paymentReference: input.payment.paymentReference,
      outstanding,
      includePaymentDate: true,
      paidAt: input.payment.paidAt
    }),
    thankYou: 'Thank you for your payment.',
    keepCopy: 'Please keep this receipt for your records.',
    paidInFull
  };
}
