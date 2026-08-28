import type { DashboardDetailResult } from '@/lib/dashboard-metric-details';

export type CanonicalProfitMetrics = {
  expectedRevenue: number;
  contractorPay: number;
  otherExpenses: number;
  estimatedProfit: number;
};

function money(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

/**
 * Keep the Profit drill-down tied to the same service-date finance engine as the
 * dashboard card. Payment-date cash belongs to Money received, not Job revenue.
 */
export function reconcileProfitDetail(
  details: DashboardDetailResult,
  canonical: CanonicalProfitMetrics
): DashboardDetailResult {
  const expectedRevenue = money(canonical.expectedRevenue);
  const contractorPay = money(canonical.contractorPay);
  const otherExpenses = money(canonical.otherExpenses);
  const estimatedProfit = money(canonical.estimatedProfit);

  const sections = details.sections.map((section) => {
    if (section.id === 'expected-revenue') {
      return {
        ...section,
        formula: 'Job revenue for work in the selected period, based on each job service date.',
        total: expectedRevenue,
        totalLabel: section.totalLabel.replace(/[-$0-9,.]+/, String(expectedRevenue))
      };
    }
    if (section.id === 'contractor') {
      return { ...section, total: contractorPay };
    }
    if (section.id === 'expenses') {
      return { ...section, total: otherExpenses };
    }
    if (section.id === 'profit') {
      return {
        ...section,
        formula: `Job revenue ${expectedRevenue.toFixed(2)} - contractor costs ${contractorPay.toFixed(2)} - business expenses ${otherExpenses.toFixed(2)} = ${estimatedProfit.toFixed(2)}`,
        total: estimatedProfit
      };
    }
    return section;
  });

  return {
    ...details,
    total: estimatedProfit,
    formula: 'Profit = Job revenue - contractor costs - business expenses. Job revenue follows the job service date, not the customer payment date.',
    sections
  };
}
