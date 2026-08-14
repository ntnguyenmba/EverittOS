/**
 * Dashboard / bookkeeping / metric-detail export loaders.
 * Finance access is enforced by the caller (requireFinanceApiAccess).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DASHBOARD_DETAILS_EXPORT_COLUMNS,
  DASHBOARD_EXPORT_COLUMNS
} from '@/lib/exports/columns';
import { formatExportMoney } from '@/lib/exports/format';
import { preparedFromColumns, type PreparedExport } from '@/lib/exports/prepared';
import {
  fetchDashboardMetricDetails,
  isDashboardDetailMetric,
  type DashboardDetailResult
} from '@/lib/dashboard-metric-details';
import {
  calculateEstimatedProfit,
  calculateJobRevenue,
  calculateMoneyKept,
  customersOweForRange,
  fetchDashboardRevenueMetrics,
  type DashboardDateRange
} from '@/lib/dashboard-metrics';
import { getDashboardFinanceCopy } from '@/lib/i18n/dashboard-finance-copy';
import type { ExportCopy } from '@/lib/i18n/export-copy';
import { normalizeLocale } from '@/lib/i18n/config';

const DASHBOARD_RANGES = new Set<DashboardDateRange>([
  'today',
  'week',
  'month',
  'quarter',
  'year',
  'last_year',
  'all_time'
]);

const DETAILS_RANGES = new Set<DashboardDateRange>(['month', 'quarter', 'year', 'last_year', 'all_time']);

export function parseDashboardRange(
  value: string | null | undefined,
  fallback: DashboardDateRange = 'month'
): DashboardDateRange {
  const raw = String(value || '').trim() as DashboardDateRange;
  return DASHBOARD_RANGES.has(raw) ? raw : fallback;
}

function parseDetailsRange(value: string | null | undefined): DashboardDateRange {
  const raw = String(value || '').trim() as DashboardDateRange;
  return DETAILS_RANGES.has(raw) ? raw : 'month';
}

function companyNameFrom(name: string | null | undefined): string {
  return String(name || '').trim() || 'EverittOS';
}

function flattenDetails(details: DashboardDetailResult): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];
  for (const section of details.sections) {
    for (const row of section.rows) {
      rows.push({
        section: section.title,
        title: row.title,
        details: [row.subtitle, row.meta].filter(Boolean).join(' · '),
        amount: row.amount == null ? String(row.amountLabel || '') : formatExportMoney(row.amount)
      });
    }
  }
  return rows;
}

export async function loadDashboardExport(input: {
  supabase: SupabaseClient;
  organizationId: string;
  companyName: string;
  searchParams: URLSearchParams;
  copy: ExportCopy;
  locale?: string | null;
}): Promise<{ ok: true; data: PreparedExport } | { ok: false; error: string; status: number }> {
  const range = parseDashboardRange(input.searchParams.get('range'));
  const locale = normalizeLocale(input.locale || input.searchParams.get('locale'));
  const finance = getDashboardFinanceCopy(locale);
  const metrics = await fetchDashboardRevenueMetrics(input.supabase, input.organizationId, range);

  const collected = metrics.paidToYou ?? metrics.cashCollected ?? 0;
  const outstanding = customersOweForRange(range, metrics.stillOwed ?? 0, metrics.periodOutstanding ?? metrics.stillOwed ?? 0);
  const contractorPaid = metrics.contractorPaymentsPaid ?? 0;
  const contractorCost = metrics.contractorPayThisMonth ?? 0;
  const expenses = metrics.otherExpensesThisMonth ?? metrics.expenseTotalThisMonth ?? 0;
  const expectedRevenue = Number.isFinite(metrics.expectedRevenue)
    ? metrics.expectedRevenue
    : calculateJobRevenue(collected, outstanding);
  const cashAfterPaidCosts = Number.isFinite(metrics.cashAfterPaidCosts)
    ? metrics.cashAfterPaidCosts
    : calculateMoneyKept({ moneyReceived: collected, paidContractors: contractorPaid, businessExpenses: expenses });
  const expectedProfit = Number.isFinite(metrics.estimatedProfit)
    ? metrics.estimatedProfit
    : calculateEstimatedProfit({ expectedRevenue, contractorPay: contractorCost, otherExpenses: expenses });

  const exportRows = [
    { metric: finance.money.collected, amount: formatExportMoney(collected) },
    { metric: finance.money.outstanding, amount: formatExportMoney(outstanding) },
    { metric: finance.money.cashAfterCosts, amount: formatExportMoney(cashAfterPaidCosts) },
    { metric: finance.money.expectedRevenue, amount: formatExportMoney(expectedRevenue) },
    { metric: finance.money.contractorPayPaid, amount: formatExportMoney(contractorPaid) },
    { metric: finance.money.contractorCost, amount: formatExportMoney(contractorCost) },
    { metric: finance.money.otherExpenses, amount: formatExportMoney(expenses) },
    { metric: finance.money.expectedProfit, amount: formatExportMoney(expectedProfit) },
    { metric: finance.metricTitles.jobs, amount: String(metrics.totalJobs ?? 0) }
  ];

  return {
    ok: true,
    data: preparedFromColumns(DASHBOARD_EXPORT_COLUMNS, exportRows, {
      filenamePrefix: 'dashboard',
      title: input.copy.dashboardTitle,
      companyName: companyNameFrom(input.companyName),
      appliedFilters: [`${input.copy.rangeLabel}: ${finance.ranges[range]}`],
      privateLabel: input.copy.privateCompanyRecord,
      summary: [
        { label: finance.money.collected, value: formatExportMoney(collected) },
        { label: finance.money.cashAfterCosts, value: formatExportMoney(cashAfterPaidCosts) }
      ]
    })
  };
}

export async function loadDashboardDetailsExport(input: {
  supabase: SupabaseClient;
  organizationId: string;
  companyName: string;
  searchParams: URLSearchParams;
  copy: ExportCopy;
  locale?: string | null;
}): Promise<{ ok: true; data: PreparedExport } | { ok: false; error: string; status: number }> {
  const locale = normalizeLocale(input.locale || input.searchParams.get('locale'));
  const metricParam = input.searchParams.get('metric');
  if (!isDashboardDetailMetric(metricParam)) {
    return { ok: false, error: 'Unknown dashboard metric.', status: 400 };
  }
  const range = parseDetailsRange(input.searchParams.get('range'));
  const details = await fetchDashboardMetricDetails(
    input.supabase,
    input.organizationId,
    metricParam,
    range,
    locale
  );
  const finance = getDashboardFinanceCopy(locale);
  const exportRows = flattenDetails(details);

  return {
    ok: true,
    data: {
      ...preparedFromColumns(DASHBOARD_DETAILS_EXPORT_COLUMNS, exportRows, {
        filenamePrefix: 'dashboard-details',
        title: details.title || input.copy.dashboardDetailsTitle,
        companyName: companyNameFrom(input.companyName),
        appliedFilters: [`${input.copy.rangeLabel}: ${finance.ranges[range]}`],
        privateLabel: input.copy.privateCompanyRecord,
        summary: [{ label: input.copy.totalLabel, value: formatExportMoney(details.total) }]
      }),
      sections: details.sections.map((section) => ({
        title: section.title,
        summary: [{ label: input.copy.totalLabel, value: section.totalLabel }],
        headers: ['Title', 'Details', 'Amount'],
        rows: section.rows.map((row) => [
          row.title,
          [row.subtitle, row.meta].filter(Boolean).join(' · '),
          row.amount == null ? String(row.amountLabel || '') : formatExportMoney(row.amount)
        ])
      }))
    }
  };
}

export async function loadBookkeepingExport(input: {
  supabase: SupabaseClient;
  organizationId: string;
  companyName: string;
  searchParams: URLSearchParams;
  copy: ExportCopy;
  locale?: string | null;
}): Promise<{ ok: true; data: PreparedExport } | { ok: false; error: string; status: number }> {
  const locale = normalizeLocale(input.locale || input.searchParams.get('locale'));
  const requested = String(input.searchParams.get('range') || 'year');
  const range: DashboardDateRange = requested === 'all_time' ? 'all_time' : 'year';
  const finance = getDashboardFinanceCopy(locale);

  const [income, netCash] = await Promise.all([
    fetchDashboardMetricDetails(input.supabase, input.organizationId, 'collected', range, locale),
    fetchDashboardMetricDetails(input.supabase, input.organizationId, 'net-cash', range, locale)
  ]);

  const incomeRows = income.sections.flatMap((section) => section.rows);
  const contractorSection = netCash.sections.find((section) => section.id === 'contractor-paid');
  const expenseSection = netCash.sections.find((section) => section.id === 'expenses');

  const exportRows = [
    ...incomeRows.map((row) => ({
      section: finance.money.collected,
      title: row.title,
      details: [row.subtitle, row.meta].filter(Boolean).join(' · '),
      amount: row.amount == null ? String(row.amountLabel || '') : formatExportMoney(row.amount)
    })),
    ...(contractorSection?.rows || []).map((row) => ({
      section: finance.money.contractorPayPaid,
      title: row.title,
      details: [row.subtitle, row.meta].filter(Boolean).join(' · '),
      amount: row.amount == null ? String(row.amountLabel || '') : formatExportMoney(row.amount)
    })),
    ...(expenseSection?.rows || []).map((row) => ({
      section: finance.money.otherExpenses,
      title: row.title,
      details: [row.subtitle, row.meta].filter(Boolean).join(' · '),
      amount: row.amount == null ? String(row.amountLabel || '') : formatExportMoney(row.amount)
    }))
  ];

  return {
    ok: true,
    data: {
      ...preparedFromColumns(DASHBOARD_DETAILS_EXPORT_COLUMNS, exportRows, {
        filenamePrefix: 'bookkeeping',
        title: input.copy.bookkeepingTitle,
        companyName: companyNameFrom(input.companyName),
        appliedFilters: [`${input.copy.rangeLabel}: ${finance.ranges[range]}`],
        privateLabel: input.copy.privateCompanyRecord,
        summary: [{ label: finance.money.collected, value: formatExportMoney(income.total) }]
      }),
      sections: [
        {
          title: finance.money.collected,
          headers: ['Title', 'Details', 'Amount'],
          rows: incomeRows.map((row) => [
            row.title,
            [row.subtitle, row.meta].filter(Boolean).join(' · '),
            row.amount == null ? String(row.amountLabel || '') : formatExportMoney(row.amount)
          ])
        },
        {
          title: finance.money.contractorPayPaid,
          headers: ['Title', 'Details', 'Amount'],
          rows: (contractorSection?.rows || []).map((row) => [
            row.title,
            [row.subtitle, row.meta].filter(Boolean).join(' · '),
            row.amount == null ? String(row.amountLabel || '') : formatExportMoney(row.amount)
          ])
        },
        {
          title: finance.money.otherExpenses,
          headers: ['Title', 'Details', 'Amount'],
          rows: (expenseSection?.rows || []).map((row) => [
            row.title,
            [row.subtitle, row.meta].filter(Boolean).join(' · '),
            row.amount == null ? String(row.amountLabel || '') : formatExportMoney(row.amount)
          ])
        }
      ]
    }
  };
}
