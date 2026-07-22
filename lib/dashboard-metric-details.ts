import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calculateLatePayments,
  calculateCashAfterPaidCosts,
  calculateEstimatedProfit,
  calculateExpectedRevenue,
  calculateOutstandingBreakdown,
  calculatePaidToYou,
  calculateUninvoicedExpectedRevenue,
  cappedAmountPaid,
  collectibleInvoicedJobIds,
  inRange,
  isCollectibleInvoice,
  num,
  rangeBounds,
  remainingBalance,
  type DashboardDateRange,
  type InvoiceMetricRow,
  type InvoicePaymentRow,
  type JobExpectedRevenueRow,
  type JobPaymentMetricRow,
  type JobRevenueRow
} from '@/lib/dashboard-metrics';
import { formatLaborPaymentLabel } from '@/lib/job-labor-basis';
import {
  getJobOperationalDate,
  isActiveCustomerRecord,
  isCancelledJobStatus
} from '@/lib/job-operational-date';
import { formatCurrency } from '@/lib/finance-format';
import { getDashboardFinanceCopy } from '@/lib/i18n/dashboard-finance-copy';
import { normalizeLocale } from '@/lib/i18n/config';

export type DashboardDetailMetric =
  | 'collected'
  | 'invoiced'
  | 'outstanding'
  | 'late'
  | 'unpaid-invoices'
  | 'net-cash'
  | 'estimated-profit'
  | 'contractor-pay'
  | 'contractor-pay-owed'
  | 'contractor-pay-pending'
  | 'expenses'
  | 'completed-jobs'
  | 'jobs'
  | 'active-customers';

export type DashboardDetailRow = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  amount?: number;
  amountLabel?: string;
  href: string;
  badge?: string;
};

export type DashboardDetailSection = {
  id: string;
  title: string;
  formula: string;
  total: number;
  totalLabel: string;
  rows: DashboardDetailRow[];
};

export type DashboardDetailResult = {
  metric: DashboardDetailMetric;
  title: string;
  range: DashboardDateRange;
  rangeLabel: string;
  total: number;
  formula: string;
  sections: DashboardDetailSection[];
};

function money(value: number) {
  return formatCurrency(value);
}

function dateLabel(value: string | null | undefined, locale = 'en') {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function isDashboardDetailMetric(value: string | null | undefined): value is DashboardDetailMetric {
  const copy = getDashboardFinanceCopy('en');
  return Boolean(value && value in copy.metricTitles);
}

export async function fetchDashboardMetricDetails(
  supabase: SupabaseClient,
  organizationId: string,
  metric: DashboardDetailMetric,
  range: DashboardDateRange = 'month',
  localeInput: string | null | undefined = 'en'
): Promise<DashboardDetailResult> {
  const locale = normalizeLocale(localeInput);
  const copy = getDashboardFinanceCopy(locale);
  const { start, end } = rangeBounds(range);
  const rangeLabel = copy.ranges[range];
  const today = new Date().toISOString().slice(0, 10);

  const empty = (
    formula: string,
    sections: DashboardDetailSection[] = [],
    totalOverride?: number
  ): DashboardDetailResult => ({
    metric,
    title: copy.metricTitles[metric],
    range,
    rangeLabel,
    total:
      typeof totalOverride === 'number'
        ? totalOverride
        : sections.reduce((sum, section) => sum + section.total, 0),
    formula: formula || copy.formulas[metric],
    sections
  });

  if (metric === 'collected') {
    const [invoicePaymentsRes, jobPaymentsRes, invoicesRes, jobsRes] = await Promise.all([
      supabase
        .from('invoice_payments')
        .select('id, amount, paid_at, payment_method, payment_reference, invoice_id')
        .eq('organization_id', organizationId)
        .order('paid_at', { ascending: false }),
      supabase
        .from('job_payments')
        .select('id, amount, paid_at, payment_method, payment_reference, job_id')
        .eq('organization_id', organizationId)
        .order('paid_at', { ascending: false }),
      supabase
        .from('invoices')
        .select('id, job_id, customer_id, amount, amount_paid, payment_status, status, invoice_date, created_at')
        .eq('organization_id', organizationId),
      supabase.from('jobs').select('id, title, customer_name').eq('organization_id', organizationId)
    ]);

    const invoices = (invoicesRes.data || []) as InvoiceMetricRow[];
    const invoicePayments = (invoicePaymentsRes.data || []) as Array<InvoicePaymentRow & { id?: string; payment_method?: string; payment_reference?: string }>;
    const jobPayments = (jobPaymentsRes.data || []) as Array<JobPaymentMetricRow & { id?: string; payment_method?: string; payment_reference?: string }>;
    const jobs = new Map((jobsRes.data || []).map((job) => [String(job.id), job]));
    const invoiceMap = new Map(invoices.map((inv) => [String(inv.id || ''), inv]));

    const { paidToYou } = calculatePaidToYou({
      invoices,
      paymentRows: invoicePayments,
      jobPaymentRows: jobPayments,
      start,
      end,
      range
    });

    const invoiceRows: DashboardDetailRow[] = [];
    for (const payment of invoicePayments) {
      if (range !== 'all_time' && !inRange(payment.paid_at, start, end)) continue;
      const invoice = invoiceMap.get(String(payment.invoice_id || ''));
      if (invoice && !isCollectibleInvoice(invoice)) continue;
      const job = invoice?.job_id ? jobs.get(String(invoice.job_id)) : null;
      invoiceRows.push({
        id: String(payment.id || `${payment.invoice_id}-${payment.paid_at}`),
        title: job?.title || 'Invoice payment',
        subtitle: [dateLabel(String(payment.paid_at || '')), payment.payment_method || null, payment.payment_reference || null]
          .filter(Boolean)
          .join(' · '),
        meta: 'Invoice payment',
        amount: num(payment.amount),
        amountLabel: money(num(payment.amount)),
        href: invoice?.job_id ? `/jobs/${invoice.job_id}` : '/invoices',
        badge: 'Invoice payment'
      });
    }

    const jobRows: DashboardDetailRow[] = [];
    for (const payment of jobPayments) {
      if (range !== 'all_time' && !inRange(payment.paid_at, start, end)) continue;
      const job = payment.job_id ? jobs.get(String(payment.job_id)) : null;
      jobRows.push({
        id: String(payment.id || `${payment.job_id}-${payment.paid_at}`),
        title: job?.title || job?.customer_name || 'Direct payment',
        subtitle: [dateLabel(String(payment.paid_at || '')), payment.payment_method || null, payment.payment_reference || null]
          .filter(Boolean)
          .join(' · '),
        meta: 'Direct payment',
        amount: num(payment.amount),
        amountLabel: money(num(payment.amount)),
        href: payment.job_id ? `/jobs/${payment.job_id}` : '/jobs',
        badge: 'Direct payment'
      });
    }

    return empty(
      'Collected = invoice payments + direct job payments in the selected period. The same payment is never counted twice.',
      [
        {
          id: 'invoice-payments',
          title: 'Invoice payments',
          formula: 'Payments recorded against invoices',
          total: Number(invoiceRows.reduce((sum, row) => sum + (row.amount || 0), 0).toFixed(2)),
          totalLabel: money(invoiceRows.reduce((sum, row) => sum + (row.amount || 0), 0)),
          rows: invoiceRows
        },
        {
          id: 'direct-payments',
          title: 'Direct job payments',
          formula: 'Payments recorded on jobs without requiring an invoice',
          total: Number(jobRows.reduce((sum, row) => sum + (row.amount || 0), 0).toFixed(2)),
          totalLabel: money(jobRows.reduce((sum, row) => sum + (row.amount || 0), 0)),
          rows: jobRows
        }
      ].map((section) => ({ ...section, totalLabel: money(section.total) })).concat([])
    );
  }

  if (metric === 'invoiced' || metric === 'unpaid-invoices' || metric === 'late' || metric === 'outstanding') {
    const [invoicesRes, jobsRes, jobPaymentsRes, jobsRevenueRes, invoicePaymentsRes] = await Promise.all([
      supabase
        .from('invoices')
        .select(
          'id, job_id, customer_id, amount, amount_paid, invoice_date, created_at, due_date, payment_status, status'
        )
        .eq('organization_id', organizationId)
        .order('invoice_date', { ascending: false }),
      supabase.from('jobs').select('id, title, customer_name').eq('organization_id', organizationId),
      supabase.from('job_payments').select('amount, paid_at, job_id').eq('organization_id', organizationId),
      supabase
        .from('jobs')
        .select('id, title, customer_name, revenue_amount, status, completed_at, start_date, scheduled_start, created_at')
        .eq('organization_id', organizationId)
        .not('revenue_amount', 'is', null),
      supabase
        .from('invoice_payments')
        .select('amount, paid_at, invoice_id')
        .eq('organization_id', organizationId)
    ]);

    const invoices = (invoicesRes.data || []) as InvoiceMetricRow[];
    const jobs = new Map((jobsRes.data || []).map((job) => [String(job.id), job]));
    const jobPayments = (jobPaymentsRes.data || []) as JobPaymentMetricRow[];
    const invoicePayments = invoicePaymentsRes.error
      ? []
      : ((invoicePaymentsRes.data || []) as InvoicePaymentRow[]);

    if (metric === 'invoiced') {
      const rows: DashboardDetailRow[] = [];
      let total = 0;
      for (const inv of invoices) {
        if (!isCollectibleInvoice(inv)) continue;
        const booked = String(inv.invoice_date || inv.created_at || '').slice(0, 10);
        if (range !== 'all_time' && !inRange(booked, start, end)) continue;
        const amount = num(inv.amount);
        total += amount;
        const job = inv.job_id ? jobs.get(String(inv.job_id)) : null;
        const paid = cappedAmountPaid(inv.amount, inv.amount_paid);
        rows.push({
          id: String(inv.id || booked),
          title: job?.title || job?.customer_name || 'Invoice',
          subtitle: `${dateLabel(booked)} · Paid ${money(paid)} · Remaining ${money(remainingBalance(inv.amount, inv.amount_paid))}`,
          amount,
          amountLabel: money(amount),
          href: '/invoices',
          badge: String(inv.payment_status || inv.status || 'sent')
        });
      }
      return empty('Invoiced = non-cancelled invoice totals created in the selected period.', [
        {
          id: 'invoices',
          title: 'Invoices created',
          formula: 'Invoice date in selected period',
          total: Number(total.toFixed(2)),
          totalLabel: money(total),
          rows
        }
      ]);
    }

    if (metric === 'late' || metric === 'unpaid-invoices') {
      const late = calculateLatePayments(invoices, today);
      const rows: DashboardDetailRow[] = [];
      let total = 0;
      for (const inv of invoices) {
        if (!isCollectibleInvoice(inv)) continue;
        const balance = remainingBalance(inv.amount, inv.amount_paid);
        if (balance <= 0) continue;
        if (metric === 'late') {
          const due = inv.due_date ? String(inv.due_date).slice(0, 10) : '';
          if (!due || due >= today) continue;
        }
        total += balance;
        const job = inv.job_id ? jobs.get(String(inv.job_id)) : null;
        rows.push({
          id: String(inv.id),
          title: job?.title || job?.customer_name || 'Invoice',
          subtitle:
            metric === 'late'
              ? `Due ${dateLabel(String(inv.due_date || ''))}`
              : `Status ${String(inv.payment_status || inv.status || 'unpaid')}`,
          amount: balance,
          amountLabel: money(balance),
          href: '/invoices?payment=unpaid&focus=outstanding',
          badge: metric === 'late' ? 'Late' : 'Unpaid'
        });
      }
      return empty(
        metric === 'late'
          ? 'Late = unpaid invoice balances past their due date.'
          : 'Unpaid invoices = invoices with a remaining balance.',
        [
          {
            id: metric,
            title: copy.metricTitles[metric],
            formula: metric === 'late' ? `Current late total ${money(late.amount)}` : 'Current unpaid balances',
            total: Number(total.toFixed(2)),
            totalLabel: money(total),
            rows
          }
        ]
      );
    }

    // outstanding — shared helper so card total always equals drill-down sum
    const breakdown = calculateOutstandingBreakdown({
      invoices,
      jobs: (jobsRevenueRes.data || []) as JobRevenueRow[],
      jobPayments,
      invoicePayments,
      jobLookup: jobs
    });
    const invoiceRows: DashboardDetailRow[] = [];
    const jobRows: DashboardDetailRow[] = [];
    for (const row of breakdown.rows) {
      const detail: DashboardDetailRow = {
        id: row.id,
        title: row.customerName ? `${row.customerName} · ${row.title}` : row.title,
        subtitle:
          row.sourceType === 'invoice'
            ? `Invoice · Expected/invoiced ${money(row.expectedOrInvoiced)} · Paid ${money(row.amountPaid)} · Owed ${money(row.amountOwed)}${
                row.dueDate ? ` · Due ${dateLabel(row.dueDate)}` : ''
              }${row.invoiceStatus ? ` · ${row.invoiceStatus}` : ''}`
            : `No invoice · Expected ${money(row.expectedOrInvoiced)} · Paid ${money(row.amountPaid)} · Owed ${money(row.amountOwed)}`,
        amount: row.amountOwed,
        amountLabel: money(row.amountOwed),
        href: row.href,
        badge: row.sourceType === 'invoice' ? 'Invoice' : 'No invoice'
      };
      if (row.sourceType === 'invoice') invoiceRows.push(detail);
      else jobRows.push(detail);
    }

    return empty(
      'Outstanding = money customers still owe: unpaid collectible invoice balances plus unpaid expected amounts on jobs without an invoice.',
      [
        {
          id: 'unpaid-invoices',
          title: 'Unpaid invoices',
          formula: `Exact total ${money(breakdown.total)} · Invoice share ${money(breakdown.invoiceTotal)}`,
          total: breakdown.invoiceTotal,
          totalLabel: money(breakdown.invoiceTotal),
          rows: invoiceRows
        },
        {
          id: 'uninvoiced-jobs',
          title: 'Uninvoiced job balances',
          formula: `Job share ${money(breakdown.jobTotal)}`,
          total: breakdown.jobTotal,
          totalLabel: money(breakdown.jobTotal),
          rows: jobRows
        }
      ]
    );
  }

  if (metric === 'expenses' || metric === 'net-cash' || metric === 'estimated-profit') {
    const [expensesRes, laborRes, invoicesRes, paymentRowsRes, jobPaymentsRes, manualJobsRes] = await Promise.all([
      supabase
        .from('expenses')
        .select('id, date, category, vendor, description, amount, job_id')
        .eq('organization_id', organizationId)
        .order('date', { ascending: false }),
      supabase
        .from('job_labor')
        .select('id, job_id, worker_name, total_cost, payment_status, paid_at, created_at, hours, hourly_cost')
        .eq('organization_id', organizationId),
      supabase
        .from('invoices')
        .select('id, amount, amount_paid, invoice_date, created_at, payment_status, status, job_id')
        .eq('organization_id', organizationId),
      supabase.from('invoice_payments').select('amount, paid_at, invoice_id').eq('organization_id', organizationId),
      supabase.from('job_payments').select('amount, paid_at, job_id').eq('organization_id', organizationId),
      supabase
        .from('jobs')
        .select('id, title, revenue_amount, created_at, start_date, scheduled_start, completed_at, status')
        .eq('organization_id', organizationId)
        .not('revenue_amount', 'is', null)
    ]);

    const expenseRows = (expensesRes.data || []).filter((row) => range === 'all_time' || inRange(row.date, start, end));
    const expenseTotal = expenseRows.reduce((sum, row) => sum + num(row.amount), 0);
    const expenseDetailRows: DashboardDetailRow[] = expenseRows.map((row) => ({
      id: String(row.id),
      title: String(row.category || 'Expense'),
      subtitle: [dateLabel(String(row.date || '')), row.vendor, row.description].filter(Boolean).join(' · '),
      amount: num(row.amount),
      amountLabel: money(num(row.amount)),
      href: '/expenses',
      badge: 'Expense'
    }));

    if (metric === 'expenses') {
      return empty('Expenses = expense amounts with dates in the selected period.', [
        {
          id: 'expenses',
          title: 'Expenses',
          formula: 'Expense date in selected period',
          total: Number(expenseTotal.toFixed(2)),
          totalLabel: money(expenseTotal),
          rows: expenseDetailRows
        }
      ]);
    }

    const invoices = (invoicesRes.data || []) as InvoiceMetricRow[];
    const { paidToYou } = calculatePaidToYou({
      invoices,
      paymentRows: (paymentRowsRes.data || []) as InvoicePaymentRow[],
      jobPaymentRows: (jobPaymentsRes.data || []) as JobPaymentMetricRow[],
      start,
      end,
      range
    });

    if (metric === 'net-cash') {
      const laborRows = (laborRes.data || []).filter((row) => {
        if (String(row.payment_status || '').toLowerCase() !== 'paid') return false;
        return range === 'all_time' || inRange(row.paid_at || row.created_at, start, end);
      });
      const contractorCashPaid = laborRows.reduce((sum, row) => sum + num(row.total_cost), 0);
      const net = calculateCashAfterPaidCosts({
        cashCollected: paidToYou,
        contractorCashPaid,
        otherCashExpenses: expenseTotal
      });
      return empty(
        copy.formulas['net-cash'],
        [
          {
            id: 'collected',
            title: copy.money.collected,
            formula: 'Invoice + direct payments by paid date',
            total: paidToYou,
            totalLabel: money(paidToYou),
            rows: []
          },
          {
            id: 'contractor-paid',
            title: copy.money.contractorPay,
            formula: 'Labor marked paid in selected period',
            total: Number(contractorCashPaid.toFixed(2)),
            totalLabel: money(contractorCashPaid),
            rows: laborRows.map((row) => ({
              id: String(row.id),
              title: row.worker_name || 'Contractor',
              subtitle: [dateLabel(String(row.paid_at || row.created_at || '')), row.payment_status]
                .filter(Boolean)
                .join(' · '),
              amount: num(row.total_cost),
              amountLabel: money(num(row.total_cost)),
              href: row.job_id ? `/jobs/${row.job_id}` : '/contractor-pay',
              badge: 'Paid'
            }))
          },
          {
            id: 'expenses',
            title: copy.money.otherExpenses,
            formula: 'Expense date in selected period',
            total: Number(expenseTotal.toFixed(2)),
            totalLabel: money(expenseTotal),
            rows: expenseDetailRows
          },
          {
            id: 'net',
            title: copy.money.cashAfterCosts,
            formula: `${money(paidToYou)} − ${money(contractorCashPaid)} − ${money(expenseTotal)} = ${money(net)}`,
            total: net,
            totalLabel: money(net),
            rows: []
          }
        ],
        net
      );
    }

    // estimated profit = expected revenue − contractor incurred − expenses
    const laborRows = (laborRes.data || []).filter((row) => range === 'all_time' || inRange(row.created_at, start, end));
    const contractorCost = laborRows.reduce((sum, row) => sum + num(row.total_cost), 0);
    const invoiced = invoices.reduce((sum, inv) => {
      if (!isCollectibleInvoice(inv)) return sum;
      return range === 'all_time' || inRange(inv.invoice_date || inv.created_at, start, end)
        ? sum + num(inv.amount)
        : sum;
    }, 0);
    const invoicedJobIds = collectibleInvoicedJobIds(invoices);
    const uninvoiced = calculateUninvoicedExpectedRevenue(
      (manualJobsRes.data || []) as JobExpectedRevenueRow[],
      invoicedJobIds,
      start,
      end
    );
    const expectedRevenue = calculateExpectedRevenue(invoiced, uninvoiced);
    const expectedProfit = calculateEstimatedProfit({
      expectedRevenue,
      contractorPay: contractorCost,
      otherExpenses: expenseTotal
    });
    return empty(copy.formulas['estimated-profit'], [
      {
        id: 'expected-revenue',
        title: copy.money.expectedRevenue,
        formula: 'Invoices created in period + uninvoiced job expected revenue',
        total: expectedRevenue,
        totalLabel: money(expectedRevenue),
        rows: []
      },
      {
        id: 'invoiced',
        title: copy.money.invoiced,
        formula: 'Invoices created in period',
        total: Number(invoiced.toFixed(2)),
        totalLabel: money(invoiced),
        rows: []
      },
      {
        id: 'uninvoiced',
        title: copy.money.uninvoicedWork,
        formula: 'Jobs with expected revenue and no invoice',
        total: Number(uninvoiced.toFixed(2)),
        totalLabel: money(uninvoiced),
        rows: []
      },
      {
        id: 'contractor',
        title: copy.money.contractorCost,
        formula: 'Labor recorded in period',
        total: Number(contractorCost.toFixed(2)),
        totalLabel: money(contractorCost),
        rows: laborRows.map((row) => ({
          id: String(row.id),
          title: row.worker_name || 'Contractor',
          subtitle: String(row.payment_status || 'unpaid'),
          amount: num(row.total_cost),
          amountLabel: money(num(row.total_cost)),
          href: row.job_id ? `/jobs/${row.job_id}` : '/contractor-pay',
          badge: 'Contractor'
        }))
      },
      {
        id: 'expenses',
        title: copy.money.otherExpenses,
        formula: 'Expense date in period',
        total: Number(expenseTotal.toFixed(2)),
        totalLabel: money(expenseTotal),
        rows: expenseDetailRows
      },
      {
        id: 'profit',
        title: copy.money.expectedProfit,
        formula: `${money(expectedRevenue)} − ${money(contractorCost)} − ${money(expenseTotal)} = ${money(expectedProfit)}`,
        total: expectedProfit,
        totalLabel: money(expectedProfit),
        rows: []
      }
    ], expectedProfit);
  }

  if (metric.startsWith('contractor-pay')) {
    const statusFilter =
      metric === 'contractor-pay-owed' ? 'unpaid' : metric === 'contractor-pay-pending' ? 'pending' : null;
    const { data } = await supabase
      .from('job_labor')
      .select('id, job_id, worker_name, hours, hourly_cost, total_cost, payment_status, paid_at, created_at, payment_basis')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    const rows = (data || []).filter((row) => {
      if (statusFilter && String(row.payment_status || 'unpaid') !== statusFilter) return false;
      if (metric === 'contractor-pay') {
        return range === 'all_time' || inRange(row.created_at, start, end);
      }
      return true;
    });
    const total = rows.reduce((sum, row) => sum + num(row.total_cost), 0);
    return empty('Contractor pay = labor totals for the selected filter.', [
      {
        id: 'contractor-pay',
        title: copy.metricTitles[metric],
        formula: statusFilter ? `Status = ${statusFilter}` : 'Labor recorded in period',
        total: Number(total.toFixed(2)),
        totalLabel: money(total),
        rows: rows.map((row) => ({
          id: String(row.id),
          title: row.worker_name || 'Contractor',
          subtitle: [
            formatLaborPaymentLabel({
              paymentBasis: row.payment_basis,
              quantity: row.hours,
              rate: row.hourly_cost,
              total: row.total_cost
            }),
            row.payment_status || 'unpaid'
          ].join(' · '),
          amount: num(row.total_cost),
          amountLabel: money(num(row.total_cost)),
          href: row.job_id ? `/jobs/${row.job_id}` : '/contractor-pay',
          badge: String(row.payment_status || 'unpaid')
        }))
      }
    ]);
  }

  if (metric === 'completed-jobs' || metric === 'jobs') {
    const { data } = await supabase
      .from('jobs')
      .select('id, title, customer_name, status, completed_at, start_date, scheduled_start, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    const rows = (data || []).filter((job) => {
      if (isCancelledJobStatus(job.status)) return false;
      if (metric === 'completed-jobs' && String(job.status || '') !== 'completed') return false;
      const opDate = getJobOperationalDate(job);
      return range === 'all_time' || inRange(opDate, start, end);
    });
    return empty(
      metric === 'completed-jobs'
        ? 'Completed jobs counted by completion or work date, not by when the record was created.'
        : 'Jobs counted by operational work date in the selected period.',
      [
        {
          id: metric,
          title: copy.metricTitles[metric],
          formula: 'Operational job date in selected period',
          total: rows.length,
          totalLabel: String(rows.length),
          rows: rows.map((job) => ({
            id: String(job.id),
            title: job.title || 'Job',
            subtitle: [job.customer_name, dateLabel(getJobOperationalDate(job) || undefined), job.status]
              .filter(Boolean)
              .join(' · '),
            href: `/jobs/${job.id}`,
            badge: String(job.status || 'job')
          }))
        }
      ]
    );
  }

  // active-customers (blank pipeline_stage treated as active)
  const { data: customers } = await supabase
    .from('customers')
    .select('id, company_name, email, phone, pipeline_stage, record_type, created_at')
    .eq('organization_id', organizationId)
    .eq('record_type', 'customer')
    .order('company_name', { ascending: true });
  const rows = (customers || []).filter((customer) => isActiveCustomerRecord(customer));
  return empty(copy.formulas['active-customers'], [
    {
      id: 'active-customers',
      title: copy.metricTitles['active-customers'],
      formula: 'record_type = customer and pipeline_stage = active (blank treated as active)',
      total: rows.length,
      totalLabel: String(rows.length),
      rows: rows.map((customer) => ({
        id: String(customer.id),
        title: customer.company_name || customer.email || 'Customer',
        subtitle: [customer.phone, customer.email, customer.pipeline_stage || 'active'].filter(Boolean).join(' · '),
        href: `/customers/${customer.id}`,
        badge: 'Active'
      }))
    }
  ]);
}
