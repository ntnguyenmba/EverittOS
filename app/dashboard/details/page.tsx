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
 