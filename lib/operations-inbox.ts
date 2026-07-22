import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateInvoiceDocumentStatus, calculateInvoicePaymentStatus } from '@/lib/outbound/invoice-payment';

export type OperationsPriority = 'urgent' | 'high' | 'medium';
export type OperationsItemType =
  | 'overdue_job'
  | 'unassigned_job'
  | 'overdue_invoice'
  | 'missing_job_report';

export type OperationsInboxItem = {
  id: string;
  type: OperationsItemType;
  priority: OperationsPriority;
  title: string;
  detail: string;
  recommendedAction: string;
  href: string;
  sourceId: string;
  date: string | null;
};

type JobRow = {
  id: string;
  title: string | null;
  status: string | null;
  due_date: string | null;
  scheduled_start: string | null;
  assigned_to: string | null;
  completed_at: string | null;
};

type InvoiceRow = {
  id: string;
  invoice_number: string | null;
  amount: number | null;
  amount_paid: number | null;
  due_date: string | null;
  payment_status: string | null;
  status: string | null;
  customer_name: string | null;
};

function dateOnly(value: string | null | undefined): string | null {
  return value ? value.slice(0, 10) : null;
}

function formatDate(value: string | null): string {
  if (!value) return 'No date set';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
}

function priorityRank(priority: OperationsPriority): number {
  return priority === 'urgent' ? 0 : priority === 'high' ? 1 : 2;
}

export async function fetchOperationsInbox(
  supabase: SupabaseClient,
  organizationId: string
): Promise<OperationsInboxItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [jobsRes, invoicesRes, reportsRes] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, title, status, due_date, scheduled_start, assigned_to, completed_at')
      .eq('organization_id', organizationId)
      .limit(1000),
    supabase
      .from('invoices')
      .select('id, invoice_number, amount, amount_paid, due_date, payment_status, status, customer_name')
      .eq('organization_id', organizationId)
      .limit(1000),
    supabase
      .from('job_reports')
      .select('job_id')
      .eq('organization_id', organizationId)
      .limit(5000)
  ]);

  const jobs = (jobsRes.data || []) as JobRow[];
  const invoices = (invoicesRes.data || []) as InvoiceRow[];
  const reportJobIds = new Set(
    ((reportsRes.data || []) as Array<{ job_id: string | null }>)
      .map((row) => row.job_id)
      .filter((id): id is string => Boolean(id))
  );

  const items: OperationsInboxItem[] = [];

  for (const job of jobs) {
    const status = String(job.status || '').toLowerCase();
    const closed = ['completed', 'cancelled', 'canceled'].includes(status);
    const jobDate = dateOnly(job.scheduled_start) || dateOnly(job.due_date);
    const title = job.title || 'Untitled job';

    if (!closed && jobDate && jobDate < today) {
      items.push({
        id: `overdue-job-${job.id}`,
        type: 'overdue_job',
        priority: 'urgent',
        title: `Overdue job: ${title}`,
        detail: `This job was scheduled for ${formatDate(jobDate)} and is still marked ${status || 'open'}.`,
        recommendedAction: 'Review the job, update its status, or reschedule it.',
        href: `/jobs/${job.id}`,
        sourceId: job.id,
        date: jobDate
      });
    }

    if (!closed && !job.assigned_to && jobDate && jobDate >= today && jobDate <= sevenDaysFromNow) {
      items.push({
        id: `unassigned-job-${job.id}`,
        type: 'unassigned_job',
        priority: jobDate === today ? 'urgent' : 'high',
        title: `Unassigned job: ${title}`,
        detail: `This job is scheduled for ${formatDate(jobDate)} but has no assigned worker or crew.`,
        recommendedAction: 'Assign a worker before the scheduled date.',
        href: `/jobs/${job.id}`,
        sourceId: job.id,
        date: jobDate
      });
    }

    if (status === 'completed' && !reportJobIds.has(job.id)) {
      const completedDate = dateOnly(job.completed_at) || jobDate;
      items.push({
        id: `missing-report-${job.id}`,
        type: 'missing_job_report',
        priority: 'medium',
        title: `Missing report: ${title}`,
        detail: `The job is completed${completedDate ? ` as of ${formatDate(completedDate)}` : ''}, but no job report was found.`,
        recommendedAction: 'Create and send the final job report.',
        href: `/jobs/${job.id}`,
        sourceId: job.id,
        date: completedDate
      });
    }
  }

  for (const invoice of invoices) {
    const amount = Number(invoice.amount || 0);
    const paid = Number(invoice.amount_paid || 0);
    const balance = Math.max(0, amount - paid);
    const paymentStatus = calculateInvoicePaymentStatus({
      amount,
      amount_paid: paid,
      due_date: invoice.due_date,
      payment_status: invoice.payment_status,
      status: invoice.status
    });
    const documentStatus = calculateInvoiceDocumentStatus({
      amount,
      amount_paid: paid,
      due_date: invoice.due_date,
      payment_status: paymentStatus,
      status: invoice.status
    });

    if (balance > 0 && documentStatus === 'overdue') {
      const label = invoice.invoice_number ? `Invoice ${invoice.invoice_number}` : 'Invoice';
      items.push({
        id: `overdue-invoice-${invoice.id}`,
        type: 'overdue_invoice',
        priority: 'urgent',
        title: `${label} is overdue`,
        detail: `${invoice.customer_name || 'Customer'} owes ${formatCurrency(balance)}${invoice.due_date ? ` since ${formatDate(invoice.due_date)}` : ''}.`,
        recommendedAction: 'Review the invoice and send a payment reminder.',
        href: `/invoices/${invoice.id}`,
        sourceId: invoice.id,
        date: dateOnly(invoice.due_date)
      });
    }
  }

  return items.sort((a, b) => {
    const priorityDifference = priorityRank(a.priority) - priorityRank(b.priority);
    if (priorityDifference !== 0) return priorityDifference;
    return String(a.date || '').localeCompare(String(b.date || ''));
  });
}
