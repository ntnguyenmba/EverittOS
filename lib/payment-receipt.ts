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

export type ReceiptCopy = {
  paidOnPrefix?: string;
  paidOnUnknown?: string;
  amountPaid?: string;
  customerDetails?: string;
  service?: string;
  paymentDate?: string;
  paymentMethod?: string;
  reference?: string;
  remainingBalance?: string;
  thankYou?: string;
  keepCopy?: string;
};

const DEFAULT_RECEIPT_COPY: Required<ReceiptCopy> = {
  paidOnPrefix: 'Paid on',
  paidOnUnknown: 'Paid on an unknown date.',
  amountPaid: 'Amount paid',
  customerDetails: 'Customer details',
  service: 'Service',
  paymentDate: 'Payment date',
  paymentMethod: 'Payment method',
  reference: 'Reference',
  remainingBalance: 'Remaining balance',
  thankYou: 'Thank you for your payment.',
  keepCopy: 'Please keep this receipt for your records.'
};

export function formatReceiptPaidOn(value: string, locale = 'en-US', copy: ReceiptCopy = {}): string {
  const labels = { ...DEFAULT_RECEIPT_COPY, ...copy };
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    const fallback = String(value || '').slice(0, 10);
    return fallback ? `${labels.paidOnPrefix} ${fallback}.` : labels.paidOnUnknown;
  }

  const formatted = new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);

  return `${labels.paidOnPrefix} ${formatted}.`;
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
  locale?: string;
  copy?: ReceiptCopy;
}): ReceiptDetailRow[] {
  const labels = { ...DEFAULT_RECEIPT_COPY, ...(input.copy || {}) };
  const rows: ReceiptDetailRow[] = [
    { label: labels.service, value: input.serviceTitle || labels.service }
  ];

  if (input.includePaymentDate && input.paidAt) {
    rows.push({
      label: labels.paymentDate,
      value: formatReceiptPaidOn(input.paidAt, input.locale || 'en-US', labels)
        .replace(new RegExp(`^${labels.paidOnPrefix}\\s+`, 'i'), '')
        .replace(/\.$/, '')
    });
  }

  const method = trimText(input.paymentMethod);
  if (method) {
    rows.push({ label: labels.paymentMethod, value: method });
  }

  const reference = trimText(input.paymentReference);
  if (reference) {
    rows.push({ label: labels.reference, value: reference });
  }

  const outstanding = Math.max(0, Number(input.outstanding || 0));
  if (outstanding > 0) {
    rows.push({ label: labels.remainingBalance, value: formatCurrency(outstanding) });
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
  copy?: ReceiptCopy;
}): PaymentReceiptView {
  const labels = { ...DEFAULT_RECEIPT_COPY, ...(input.copy || {}) };
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
    paidOnLabel: formatReceiptPaidOn(input.payment.paidAt, input.locale || 'en-US', labels),
    amountPaidLabel: labels.amountPaid,
    amountPaidValue: formatCurrency(input.payment.amount),
    businessName: trimText(input.business?.companyName),
    businessLines,
    customerHeading: labels.customerDetails,
    customerLines: customerLines.length ? customerLines : ['Customer'],
    receiptDetails: buildReceiptDetailRows({
      serviceTitle: trimText(input.job?.title) || labels.service,
      paymentMethod: input.payment.paymentMethod,
      paymentReference: input.payment.paymentReference,
      outstanding,
      includePaymentDate: true,
      paidAt: input.payment.paidAt,
      locale: input.locale,
      copy: labels
    }),
    thankYou: labels.thankYou,
    keepCopy: labels.keepCopy,
    paidInFull
  };
}
