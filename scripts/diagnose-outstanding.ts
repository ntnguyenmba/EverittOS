#!/usr/bin/env npx tsx
/**
 * Admin diagnostic: list every record contributing to Outstanding for an org.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ORGANIZATION_ID=... \
 *     npx tsx scripts/diagnose-outstanding.ts
 *
 * Does not mutate data. Prints invoice/job contributors and the shared total.
 */

import { createClient } from '@supabase/supabase-js';
import {
  calculateOutstandingBreakdown,
  type InvoiceMetricRow,
  type InvoicePaymentRow,
  type JobPaymentMetricRow,
  type JobRevenueRow
} from '@/lib/dashboard-metrics';

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const organizationId = process.env.ORGANIZATION_ID || '';

  if (!url || !key || !organizationId) {
    console.error(
      'Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, and ORGANIZATION_ID.'
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const [invoicesRes, jobsRes, jobPaymentsRes, invoicePaymentsRes] = await Promise.all([
    supabase
      .from('invoices')
      .select(
        'id, amount, amount_paid, payment_status, status, due_date, job_id, invoice_date, created_at'
      )
      .eq('organization_id', organizationId),
    supabase
      .from('jobs')
      .select('id, title, customer_name, revenue_amount, status')
      .eq('organization_id', organizationId)
      .not('revenue_amount', 'is', null),
    supabase.from('job_payments').select('amount, paid_at, job_id').eq('organization_id', organizationId),
    supabase
      .from('invoice_payments')
      .select('amount, paid_at, invoice_id')
      .eq('organization_id', organizationId)
  ]);

  if (invoicesRes.error) throw invoicesRes.error;
  if (jobsRes.error) throw jobsRes.error;

  const invoices = (invoicesRes.data || []) as InvoiceMetricRow[];
  const jobs = (jobsRes.data || []) as JobRevenueRow[];
  const jobPayments = (jobPaymentsRes.data || []) as JobPaymentMetricRow[];
  const invoicePayments = (invoicePaymentsRes.error ? [] : invoicePaymentsRes.data || []) as InvoicePaymentRow[];
  const jobLookup = new Map(jobs.map((job) => [String(job.id), job]));

  const breakdown = calculateOutstandingBreakdown({
    invoices,
    jobs,
    jobPayments,
    invoicePayments,
    jobLookup
  });

  console.log(JSON.stringify({ organizationId, total: breakdown.total, rows: breakdown.rows }, null, 2));
  console.log(`\nOutstanding total: $${breakdown.total.toFixed(2)}`);
  console.log(`Contributing rows: ${breakdown.rows.length}`);
  for (const row of breakdown.rows) {
    console.log(
      `- [${row.sourceType}] ${row.customerName || '—'} / ${row.title}: owed $${row.amountOwed.toFixed(2)} (expected $${row.expectedOrInvoiced.toFixed(2)}, paid $${row.amountPaid.toFixed(2)}) ${row.href}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
