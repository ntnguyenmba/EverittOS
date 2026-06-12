import type { EverittosPlan } from '@/lib/everittos-plans';

export type JobStatus =
  | 'new'
  | 'scheduled'
  | 'in_progress'
  | 'waiting'
  | 'completed'
  | 'cancelled';

export const JOB_STATUSES: JobStatus[] = [
  'new',
  'scheduled',
  'in_progress',
  'waiting',
  'completed',
  'cancelled'
];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  new: 'New',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  waiting: 'Waiting',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

export type PhotoLabel = 'before' | 'during' | 'after' | 'other';

export type Crew = {
  id: string;
  user_id: string;
  name: string;
  created_at?: string | null;
};

export type Worker = {
  id: string;
  user_id: string;
  name: string;
  role: string | null;
  phone: string | null;
  notes: string | null;
  created_at?: string | null;
};

export type Customer = {
  id: string;
  user_id: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  pipeline_stage?: string | null;
  lead_source?: string | null;
  record_type?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type Job = {
  id: string;
  user_id: string;
  customer_id: string | null;
  title: string;
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  location_name: string | null;
  notes: string | null;
  service_type: string | null;
  status: JobStatus | string | null;
  crew_id: string | null;
  assigned_to: string | null;
  scheduled_at: string | null;
  price_estimate: number | null;
  before_photo_url: string | null;
  after_photo_url: string | null;
  completion_notes: string | null;
  created_at: string | null;
  completed_at: string | null;
  workers?: Worker | null;
  customers?: Customer | null;
};

export type Expense = {
  id: string;
  organization_id: string;
  job_id: string | null;
  customer_id: string | null;
  worker_id: string | null;
  date: string;
  category: string;
  vendor: string | null;
  description: string | null;
  amount: number;
  payment_method: string | null;
  receipt_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type JobLabor = {
  id: string;
  organization_id: string;
  job_id: string;
  worker_id: string | null;
  worker_name: string | null;
  hours: number;
  hourly_cost: number;
  total_cost: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type JobPhoto = {
  id: string;
  user_id: string;
  job_id: string;
  storage_path: string;
  label: PhotoLabel | string;
  created_at?: string | null;
};

export type JobTimelineEvent = {
  id: string;
  user_id: string;
  job_id: string;
  event_type: string;
  message: string | null;
  created_at?: string | null;
};

export type BusinessProfile = {
  user_id: string;
  business_name: string | null;
  phone: string | null;
  email: string | null;
  logo_path: string | null;
  support_email: string | null;
  updated_at?: string | null;
};

export type Profile = {
  id: string;
  email?: string | null;
  role?: string | null;
  plan?: EverittosPlan | string | null;
  subscription_status?: string | null;
  stripe_customer_id?: string | null;
  stripe_promotion_code?: string | null;
  stripe_coupon_id?: string | null;
  coupon_name?: string | null;
  coupon_percent_off?: number | null;
  coupon_amount_off?: number | null;
  coupon_duration?: string | null;
  coupon_duration_in_months?: number | null;
  coupon_expires_at?: string | null;
  account_status?: string | null;
  business_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  reroot_report_access?: boolean | null;
  reroot_premium_until?: string | null;
  created_at?: string | null;
};

/** Matches public.template_library */
export type TemplateLibraryRow = {
  id: string;
  organization_id: string;
  category: string;
  title: string;
  body: string;
  version: number;
  parent_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Matches public.review_requests */
export type ReviewRequestRow = {
  id: string;
  organization_id: string;
  job_id: string | null;
  customer_id: string | null;
  customer_email: string | null;
  status: string;
  message: string | null;
  sent_at: string | null;
  submitted_at: string | null;
  scheduled_at: string | null;
  failure_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Matches public.customer_reviews */
export type CustomerReviewRow = {
  id: string;
  organization_id: string;
  review_request_id: string | null;
  rating: number | null;
  body: string | null;
  status: string;
  created_at: string;
};

/** Matches public.proposals (estimates use the same table) */
export type ProposalRow = {
  id: string;
  organization_id: string;
  customer_id: string | null;
  job_id: string | null;
  title: string;
  status: string;
  amount: number | null;
  body: string | null;
  sent_at: string | null;
  approved_at: string | null;
  recipient_email: string | null;
  failure_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Matches public.invoices */
export type InvoiceRow = {
  id: string;
  organization_id: string | null;
  job_id: string | null;
  customer_id: string | null;
  client_user_id: string | null;
  user_id: string | null;
  amount: number;
  amount_paid: number;
  status: string;
  due_date: string | null;
  description: string | null;
  notes: string | null;
  invoice_date: string | null;
  recipient_email: string | null;
  sent_at: string | null;
  delivery_status: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

/** Matches public.outbound_sent_history */
export type OutboundSentHistoryRow = {
  id: string;
  document_id: string;
  organization_id: string;
  event_type: string;
  recipient_email: string | null;
  subject: string | null;
  body_snapshot: string | null;
  delivery_provider: string | null;
  external_message_id: string | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
};

export type EverittosSubscription = {
  id: string;
  user_id: string | null;
  email: string;
  plan: 'pro' | 'business';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_session_id: string | null;
  stripe_promotion_code?: string | null;
  stripe_coupon_id?: string | null;
  coupon_name?: string | null;
  coupon_percent_off?: number | null;
  coupon_amount_off?: number | null;
  coupon_duration?: string | null;
  coupon_duration_in_months?: number | null;
  coupon_expires_at?: string | null;
  status: string;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};
