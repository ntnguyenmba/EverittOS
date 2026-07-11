import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateInvoicePaymentStatus } from '@/lib/outbound/invoice-payment';

export type OperationsPriority = 'urgent' | 'high' | 'medium';
export type OperationsItemType =
  | 'overdue_job'
  | 'unassigned_job'
  | 'overdue_invoice'
  | 'missing_job_report';

export type OperationsInboxItem = {
  id: string;
  type: OperationsItemType;
  priority: OperationsPriority;
  title: string;
  detail: string;
  recommendedAction