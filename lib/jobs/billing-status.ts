import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateInvoicePaymentStatus } from '@/lib/outbound/invoice-payment';

export const JOB_BILLING_STATUSES = [
  'not_invoiced',
  'draft_invoice',
  'invoice_sent',
  'partially_paid',
  'paid',
  'receipt_sent'
] as const;

export type JobBillingStatus = (typeof JOB_BILLING_STATUSES)[number];

export type JobBillingDocument = {
  id: string;
  job_id: string | null;
  doc_type: string;
  status: string | null;
  payment_status?: string | null;
  amount?: number | null;
  amount_paid?: number | null;
  source_entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function deriveJobBillingStatus(docs: JobBillingDocument[]): JobBillingStatus {
  const invoices = docs.filter((doc) => doc.doc_type === 'invoice');
  const receipts = docs.filter(
    (doc) =>
      doc.doc_type === 'receipt' ||
      (doc.doc_type === 'message' && Boolean(doc.metadata && (doc.metadata as { receipt?: boolean }).receipt))
  );

  const hasSentReceipt = receipts.some((doc) => String(doc.status || '').toLowerCase() === 'sent');
  if (hasSentReceipt) return 'receipt_sent';

  if (!invoices.length) return 'not_invoiced';

  let best: JobBillingStatus = 'draft_invoice';

  for (const invoice of invoices) {
    const paymentStatus = calculateInvoicePaymentStatus({
      amount: invoice.amount,
      amount_paid: invoice.amount_paid,
      payment_status: invoice.payment_status,
      status: invoice.status
    });

    if (paymentStatus === 'paid') {
      best = 'paid';
      continue;
    }
    if (paymentStatus === 'partially_paid' && best !== 'paid') {
      best = 'partially_paid';
      continue;
    }

    const delivery = String(invoice.status || '').toLowerCase();
    if ((delivery === 'sent' || delivery === 'scheduled' || delivery === 'failed') && best === 'draft_invoice') {
      best = 'invoice_sent';
    }
  }

  return best;
}

export async function fetchJobBillingStatuses(
  supabase: SupabaseClient,
  organizationId: string,
  jobIds: string[]
): Promise<Record<string, JobBillingStatus>> {
  const uniqueIds = Array.from(new Set(jobIds.filter(Boolean)));
  const result: Record<string, JobBillingStatus> = {};
  for (const id of uniqueIds) result[id] = 'not_invoiced';
  if (!organizationId || !uniqueIds.length) return result;

  const { data, error } = await supabase
    .from('outbound_documents')
    .select('id, job_id, doc_type, status, payment_status, amount, amount_paid, source_entity_id, metadata')
    .eq('organization_id', organizationId)
    .in('job_id', uniqueIds)
    .in('doc_type', ['invoice', 'receipt', 'message']);

  if (error || !data) return result;

  const byJob = new Map<string, JobBillingDocument[]>();
  for (const row of data as JobBillingDocument[]) {
    if (!row.job_id) continue;
    if (row.doc_type === 'message' && !(row.metadata && (row.metadata as { receipt?: boolean }).receipt)) {
      continue;
    }
    const list = byJob.get(row.job_id) || [];
    list.push(row);
    byJob.set(row.job_id, list);
  }

  byJob.forEach((docs, jobId) => {
    result[jobId] = deriveJobBillingStatus(docs);
  });

  return result;
}

export function billingStatusLabel(
  status: JobBillingStatus,
  labels: Record<JobBillingStatus, string>
): string {
  return labels[status] || labels.not_invoiced;
}
