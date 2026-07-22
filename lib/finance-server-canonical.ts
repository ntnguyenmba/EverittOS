import type { SupabaseClient } from '@supabase/supabase-js';
import type { BusinessPerformanceSummary, JobProfitability } from '@/lib/finance-types';
import {
  fetchBusinessPerformance as fetchLegacyBusinessPerformance,
  fetchJobProfitability as fetchLegacyJobProfitability,
  monthEndIso,
  monthStartIso
} from '@/lib/finance-server';
import { calculateJobPaymentStatus, calculateOutstandingBalance } from '@/lib/finance/job-payments';

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Canonical expected revenue for one job.
 *
 * A quote is an estimate, an invoice is a formal amount, and a confirmed payment
 * is realized revenue. Expected revenue must never be lower than any of them.
 */
export function canonicalExpectedJobRevenue(input: {
  quotedRevenue?: unknown;
  invoiceTotal?: unknown;
  confirmedPayments?: unknown;
}): number {
  return Number(
    Math.max(
      0,
      num(input.quotedRevenue),
      num(input.invoiceTotal),
      num(input.confirmedPayments)
    ).toFixed(2)
  );
}

/**
 * Canonical job profitability used by job, payment, and receipt APIs.
 */
export async function fetchJobProfitability(
  supabase: SupabaseClient,
  organizationId: string,
  jobId: string
): Promise<JobProfitability> {
  const profitability = await fetchLegacyJobProfitability(supabase, organizationId, jobId);
  const expectedAmount = canonicalExpectedJobRevenue({
    quotedRevenue: profitability.manualRevenue,
    invoiceTotal: profitability.invoiceTotal,
    confirmedPayments: profitability.collectedAmount
  });

  const totalExpenses = num(profitability.totalExpenses);
  const collectedAmount = num(profitability.collectedAmount);
  const outstanding = profitability.hasInvoice && num(profitability.invoiceTotal) > 0
    ? Math.max(0, expectedAmount - collectedAmount)
    : calculateOutstandingBalance(expectedAmount, collectedAmount);
  const expectedProfit = expectedAmount - totalExpenses;
  const collectedProfit = collectedAmount - totalExpenses;

  return {
    ...profitability,
    expectedAmount,
    outstanding: Number(outstanding.toFixed(2)),
    paymentStatus: calculateJobPaymentStatus(expectedAmount, collectedAmount),
    expectedProfit: Number(expectedProfit.toFixed(2)),
    collectedProfit: Number(collectedProfit.toFixed(2)),
    estimatedProfit: Number((collectedAmount > 0 ? collectedProfit : expectedProfit).toFixed(2)),
    revenueBasis: collectedAmount > 0 ? collectedAmount : expectedAmount
  };
}

/**
 * Canonical business analytics summary.
 *
 * Direct payments prove revenue even when an optional quote was blank or lower
 * than the amount ultimately collected. The legacy summary already attributes
 * those payments to jobs, customers, and workers; this wrapper corrects its
 * top-level expected-profit KPI using the same per-job revenue rule.
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
      .select('job_id, amount, payment_status, status')
      .eq('organization_id', organizationId),
    supabase
      .from('job_payments')
      .select('job_id, amount, paid_at')
      .eq('organization_id', organizationId)
      .gte('paid_at', `${start}T00:00:00`)
      .lte('paid_at', `${end}T23:59:59`)
  ]);

  if (jobsRes.error || invoicesRes.error || paymentsRes.error) return summary;

  const activeInvoiceByJob = new Map<string, number>();
  for (const invoice of invoicesRes.data || []) {
    const statuses = [invoice.payment_status, invoice.status]
      .map((value) => String(value || '').toLowerCase())
      .filter(Boolean);
    if (statuses.some((status) =>
      ['cancelled', 'canceled', 'draft', 'void', 'voided', 'deleted', 'scheduled'].includes(status)
    )) continue;
    const jobId = String(invoice.job_id || '');
    if (!jobId) continue;
    activeInvoiceByJob.set(jobId, Math.max(activeInvoiceByJob.get(jobId) || 0, num(invoice.amount)));
  }

  const paymentsByJob = new Map<string, number>();
  for (const payment of paymentsRes.data || []) {
    const jobId = String(payment.job_id || '');
    if (!jobId || activeInvoiceByJob.has(jobId)) continue;
    paymentsByJob.set(jobId, Number(((paymentsByJob.get(jobId) || 0) + num(payment.amount)).toFixed(2)));
  }

  let expectedRevenueCorrection = 0;
  for (const job of jobsRes.data || []) {
    const jobId = String(job.id || '');
    const status = String(job.status || '').toLowerCase();
    if (!jobId || status === 'cancelled' || status === 'canceled') continue;

    const quoted = num(job.revenue_amount);
    const invoiced = activeInvoiceByJob.get(jobId) || 0;
    const confirmed = paymentsByJob.get(jobId) || 0;
    const canonical = canonicalExpectedJobRevenue({
      quotedRevenue: quoted,
      invoiceTotal: invoiced,
      confirmedPayments: confirmed
    });
    const legacyExpected = invoiced > 0 ? invoiced : quoted;
    expectedRevenueCorrection += Math.max(0, canonical - legacyExpected);
  }

  if (expectedRevenueCorrection <= 0) return summary;

  return {
    ...summary,
    estimatedProfitThisMonth: Number(
      (summary.estimatedProfitThisMonth + expectedRevenueCorrection).toFixed(2)
    )
  };
}
