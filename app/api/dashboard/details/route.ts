import { NextResponse } from 'next/server';
import { fetchDashboardMetricDetails, isDashboardDetailMetric } from '@/lib/dashboard-metric-details';
import { reconcileProfitDetail } from '@/lib/dashboard-detail-reconcile';
import { buildJobOperationalDateMap, calculateOutstandingBreakdown, fetchDashboardRevenueMetrics, inRange, num, rangeBounds, type DashboardDateRange, type InvoiceMetricRow, type InvoicePaymentRow, type JobPaymentMetricRow, type JobRevenueRow } from '@/lib/dashboard-metrics';
import { formatCurrency } from '@/lib/finance-format';
import { formatLaborPaymentLabel } from '@/lib/job-labor-basis';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';

const RANGES = new Set<DashboardDateRange>(['today', 'week', 'month', 'ytd', 'year', 'all_time']);

export async function GET(request: Request) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const url = new URL(request.url); const metricParam = url.searchParams.get('metric'); const rangeParam = (url.searchParams.get('range') || 'month') as DashboardDateRange; const localeParam = url.searchParams.get('locale');
  if (!isDashboardDetailMetric(metricParam)) return NextResponse.json({ error: 'Unknown dashboard metric.' }, { status: 400 });
  const range = RANGES.has(rangeParam) ? rangeParam : 'month';
  try {
    let details = await fetchDashboardMetricDetails(ctx.supabase, ctx.organizationId, metricParam, range, localeParam);

    if (metricParam === 'estimated-profit') {
      const metrics = await fetchDashboardRevenueMetrics(ctx.supabase, ctx.organizationId, range);
      details = reconcileProfitDetail(details, {
        expectedRevenue: metrics.expectedRevenue,
        contractorPay: metrics.contractorPayThisMonth || 0,
        otherExpenses: metrics.otherExpensesThisMonth || 0,
        estimatedProfit: metrics.estimatedProfit
      });
    }

    if (metricParam === 'collected') {
      const rows = details.sections.flatMap((section) => section.rows);
      const rowTotal = Number(rows.reduce((sum, row) => sum + num(row.amount), 0).toFixed(2));
      const reportedTotal = Number(num(details.total).toFixed(2));
      const legacyDifference = Number(Math.max(0, reportedTotal - rowTotal).toFixed(2));

      if (legacyDifference > 0) {
        rows.push({
          id: `legacy-received-${range}`,
          title: 'Earlier recorded customer payments',
          subtitle: 'Payment amount saved on an invoice before the payment ledger was introduced.',
          meta: 'Customer payment',
          amount: legacyDifference,
          amountLabel: formatCurrency(legacyDifference),
          href: '/invoices',
          badge: 'Recorded payment'
        });
      }

      details.formula = 'Money received = all customer payments recorded in the selected period. Invoice and direct job payments are combined so the detail total matches the dashboard.';
      details.sections = reportedTotal > 0 || rows.length > 0
        ? [{
            id: 'customer-payments',
            title: 'Customer payments received',
            formula: 'All recorded customer payments in this period',
            total: reportedTotal,
            totalLabel: formatCurrency(reportedTotal),
            rows
          }]
        : [{
            id: 'customer-payments',
            title: 'Customer payments received',
            formula: 'No customer payments recorded in this period',
            total: 0,
            totalLabel: formatCurrency(0),
            rows: []
          }];
    }

    if (metricParam === 'contractor-pay') {
      const [{ data: labor }, { data: jobs }] = await Promise.all([
        ctx.supabase.from('job_labor').select('id, job_id, worker_name, hours, hourly_cost, total_cost, payment_status, paid_at, created_at, payment_basis').eq('organization_id', ctx.organizationId).order('created_at', { ascending: false }),
        ctx.supabase.from('jobs').select('id, status, completed_at, start_date, scheduled_start, created_at').eq('organization_id', ctx.organizationId)
      ]);
      const { start, end } = rangeBounds(range); const jobDates = buildJobOperationalDateMap(jobs || []);
      const rows = (labor || []).filter((row) => { if (range === 'all_time') return true; const jobId = String(row.job_id || ''); if (jobId) { const jobDate = jobDates.get(jobId); return Boolean(jobDate && inRange(jobDate, start, end)); } return inRange(row.created_at, start, end); });
      const total = Number(rows.reduce((sum, row) => sum + num(row.total_cost), 0).toFixed(2));
      details.total = total; details.formula = 'Worker pay = labor costs for jobs worked in the selected period.';
      details.sections = [{ id: 'contractor-pay', title: details.title, formula: 'Labor grouped by the job work date', total, totalLabel: formatCurrency(total), rows: rows.map((row) => ({ id: String(row.id), title: row.worker_name || 'Worker', subtitle: [formatLaborPaymentLabel({ paymentBasis: row.payment_basis, quantity: row.hours, rate: row.hourly_cost, total: row.total_cost }), row.payment_status || 'unpaid'].join(' · '), amount: num(row.total_cost), amountLabel: formatCurrency(num(row.total_cost)), href: row.job_id ? `/jobs/${row.job_id}` : '/contractor-pay', badge: String(row.payment_status || 'unpaid') })) }];
    }
    if (metricParam === 'outstanding') {
      const [invoicesRes, jobsRes, jobPaymentsRes, invoicePaymentsRes] = await Promise.all([
        ctx.supabase.from('invoices').select('id, job_id, amount, amount_paid, invoice_date, created_at, due_date, payment_status, status').eq('organization_id', ctx.organizationId),
        ctx.supabase.from('jobs').select('id, title, customer_name, revenue_amount, status, completed_at, start_date, scheduled_start, created_at').eq('organization_id', ctx.organizationId),
        ctx.supabase.from('job_payments').select('amount, paid_at, job_id').eq('organization_id', ctx.organizationId),
        ctx.supabase.from('invoice_payments').select('amount, paid_at, invoice_id').eq('organization_id', ctx.organizationId)
      ]);
      const invoices = (invoicesRes.data || []) as InvoiceMetricRow[]; const jobs = (jobsRes.data || []) as JobRevenueRow[]; const jobPayments = (jobPaymentsRes.data || []) as JobPaymentMetricRow[]; const invoicePayments = invoicePaymentsRes.error ? [] : ((invoicePaymentsRes.data || []) as InvoicePaymentRow[]);
      const jobLookup = new Map((jobsRes.data || []).map((job) => [String(job.id), { title: job.title, customer_name: job.customer_name }])); const jobDates = buildJobOperationalDateMap(jobsRes.data || []); const invoiceMap = new Map(invoices.map((invoice) => [String(invoice.id || ''), invoice])); const { start, end } = rangeBounds(range);
      const breakdown = calculateOutstandingBreakdown({ invoices, jobs, jobPayments, invoicePayments, jobLookup });
      const selectedRows = breakdown.rows.filter((row) => { if (range === 'all_time') return true; if (row.sourceType === 'job') { const attributed = jobDates.get(row.id); return Boolean(attributed && inRange(attributed, start, end)); } const invoice = invoiceMap.get(row.id); if (!invoice) return false; const jobId = String(invoice.job_id || ''); const attributed = (jobId && jobDates.get(jobId)) || String(invoice.invoice_date || invoice.created_at || '').slice(0, 10); return inRange(attributed, start, end); });
      const invoiceRows = selectedRows.filter((row) => row.sourceType === 'invoice'); const jobRows = selectedRows.filter((row) => row.sourceType === 'job'); const invoiceTotal = Number(invoiceRows.reduce((sum, row) => sum + row.amountOwed, 0).toFixed(2)); const jobTotal = Number(jobRows.reduce((sum, row) => sum + row.amountOwed, 0).toFixed(2)); const total = Number((invoiceTotal + jobTotal).toFixed(2));
      const toDetailRow = (row: (typeof selectedRows)[number]) => ({ id: row.id, title: row.customerName ? `${row.customerName} · ${row.title}` : row.title, subtitle: row.sourceType === 'invoice' ? `Invoice · Invoiced ${formatCurrency(row.expectedOrInvoiced)} · Paid ${formatCurrency(row.amountPaid)} · Owed ${formatCurrency(row.amountOwed)}` : `No invoice · Expected ${formatCurrency(row.expectedOrInvoiced)} · Paid ${formatCurrency(row.amountPaid)} · Owed ${formatCurrency(row.amountOwed)}`, amount: row.amountOwed, amountLabel: formatCurrency(row.amountOwed), href: row.href, badge: row.sourceType === 'invoice' ? 'Invoice' : 'No invoice' });
      details.total = total; details.formula = range === 'all_time' ? 'Still owed = all current unpaid customer balances.' : 'Still owed = current unpaid balances tied to work in the selected period.';
      details.sections = [{ id: 'unpaid-invoices', title: 'Unpaid invoices', formula: 'Unpaid invoice balances tied to the selected period', total: invoiceTotal, totalLabel: formatCurrency(invoiceTotal), rows: invoiceRows.map(toDetailRow) }, { id: 'uninvoiced-jobs', title: 'Uninvoiced job balances', formula: 'Unpaid expected job balances tied to work in the selected period', total: jobTotal, totalLabel: formatCurrency(jobTotal), rows: jobRows.map(toDetailRow) }];
    }
    return NextResponse.json({ details });
  } catch (error) { const message = error instanceof Error ? error.message : 'Unable to load metric details.'; return NextResponse.json({ error: message }, { status: 500 }); }
}
