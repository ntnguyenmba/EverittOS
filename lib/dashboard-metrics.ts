import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateInvoicePaymentStatus } from '@/lib/outbound/invoice-payment';
import { countOrganizationJobs } from '@/lib/jobs-org-query';

const CANCELLED_JOB_STATUSES = ['cancelled', 'canceled'];
const CANCELLED_BOOKING_STATUSES = ['cancelled', 'canceled'];

export type DashboardDateRange = 'month'