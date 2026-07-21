import { redirect } from 'next/navigation';

type SearchParams = Record<string, string | string[] | undefined>;

const METRIC_DESTINATIONS: Record<string, string> = {
  collected: '/invoices?payment=history',
  invoiced: '/invoices',
  outstanding: '/invoices?payment=unpaid&focus=outstanding',
  late: '/invoices?payment=overdue&focus=outstanding',
  'unpaid-invoices': '/invoices?payment=unpaid&focus=outstanding',
  'net-cash': '/analytics',
  'estimated-profit': '/analytics',
  'contractor-pay': '/contractor-pay?status=all',
  'contractor-pay-owed': '/contractor-pay?status=unpaid',
  'contractor-pay-pending': '/contractor-pay?status=pending',
  expenses: '/expenses'
};

export default async function DashboardMetricDetailsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const rawMetric = params.metric;
  const metric = Array.isArray(rawMetric) ? rawMetric[0] : rawMetric;
  redirect((metric && METRIC_DESTINATIONS[metric]) || '/dashboard');
}
