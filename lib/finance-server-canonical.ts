import type { SupabaseClient } from '@supabase/supabase-js';
import type { BusinessPerformanceSummary } from '@/lib/finance-types';
import { fetchBusinessPerformance as fetchLegacyBusinessPerformance, monthEndIso, monthStartIso } from '@/lib/finance-server';

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Canonical business analytics summary.
 *
 * A direct customer payment proves revenue even when the job has no invoice and
 * the optional expected revenue field was left blank. The legacy summary already
 * attributes those payments to jobs, customers, and workers, but its top-level
 * expected-profit KPI could still subtract labor and expenses from zero revenue.
 */
export async function fetchBusinessPerformance(
  supabase: SupabaseClient,
  organizationId: string
): Promise<BusinessPerformanceSummary> {
  const summary = await fetchLegacyBusinessPerformance(supabase, organizationId);
  const start = monthStartIso();
  const end = monthEndIso();

  const [jobsRes, invoicesRes, paymentsRes] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, revenue_amount, status')
      .eq('organization_id', organizationId),
    supabase
      .from('invoices')
      .select('job_id, payment_status, status')
      .eq('organization_id', organizationId),
    supabase
      .from('job_payments')
      .select('job_id, amount, paid_at')
      .eq('organization_id', organizationId)
      .gte('paid_at', `${start}T00:00:00`)
      .lte('paid_at', `${end}T23:59:59`)
  ]);

  if (jobsRes.error || invoicesRes.error || paymentsRes.error) return summary;

  const activeInvoicedJobIds = new Set(
    (invoicesRes.data || [])
      .filter((invoice) => {
        const statuses = [invoice.payment_status, invoice.status]
          .map((value) => String(value || '').toLowerCase())
          .filter(Boolean);
        return !statuses.some((status) =>
          ['cancelled', 'canceled', 'draft', 'void', 'voided', 'deleted', 'scheduled'].includes(status)
        );
      })
      .map((invoice) => String(invoice.job_id || ''))
      .filter(Boolean)
  );

  const eligibleJobIds = new Set(
    (jobsRes.data || [])
      .filter((job) => {
        const id = String(job.id || '');
        const status = String(job.status || '').toLowerCase();
        return (
          Boolean(id) &&
          !activeInvoicedJobIds.has(id) &&
          status !== 'cancelled' &&
          status !== 'canceled' &&
          num(job.revenue_amount) <= 0
        );
      })
      .map((job) => String(job.id))
  );

  const confirmedRevenueFallback = (paymentsRes.data || []).reduce((sum, payment) => {
    const jobId = String(payment.job_id || '');
    return eligibleJobIds.has(jobId) ? sum + num(payment.amount) : sum;
  }, 0);

  if (confirmedRevenueFallback <= 0) return summary;

  return {
    ...summary,
    estimatedProfitThisMonth: Number(
      (summary.estimatedProfitThisMonth + confirmedRevenueFallback).toFixed(2)
    )
  };
}
