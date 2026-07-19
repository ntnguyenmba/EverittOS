import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateInvoicePaymentStatus } from '@/lib/outbound/invoice-payment';
import { countOrganizationJobs } from '@/lib/jobs-org-query';

const CANCELLED_JOB_STATUSES = ['cancelled', 'canceled'];
const CANCELLED_BOOKING_STATUSES = ['cancelled', 'canceled'];

export type DashboardDateRange = 'month' | 'quarter' | 'year' | 'last_year' | 'all_time';

export type DashboardRevenueMetrics = {
  revenueThisMonth: number;
  cashCollected: number;
  bookedRevenue: number;
  pendingIncoming: number;
  overdueAmount: number;
  averageDaysToPayment: number | null;
  outstandingInvoices: number;
  outstandingInvoiceCount: number;
  overdueInvoiceCount: number;
  unpaidInvoiceTotal: number;
  jobsCompleted: number;
  jobsCompletedThisMonth: number;
  activeCustomers: number;
  customerCount: number;
  upcomingJobs: number;
  contractorPayThisMonth?: number;
  contractorPaymentsPaid?: number;
  unpaidContractorPay?: number;
  pendingContractorPay?: number;
  otherExpensesThisMonth?: number;
  expenseTotalThisMonth: number;
  netEstimateThisMonth: number;
  netCashFlow: number;
  bookingCountThisMonth: number;
  messageCount: number;
  reportCount: number;
  jobsByStatus: Record<string, number>;
  totalJobs: number;
};

export type LaborCostRow = {
  total_cost?: unknown;
  created_at?: unknown;
  payment_status?: unknown;
  paid_at?: unknown;
};

function formatLocalDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayIso(): string {
  return formatLocalDateOnly(new Date());
}

export function rangeBounds(
  range: DashboardDateRange,
  now = new Date()
): { start: string | null; end: string | null } {
  const year = now