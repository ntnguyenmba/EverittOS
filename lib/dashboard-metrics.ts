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
  outstandingInvoiceCount: number