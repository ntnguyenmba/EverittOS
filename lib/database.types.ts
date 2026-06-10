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
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
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
  account_status?: string | null;
  business_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  reroot_report_access?: boolean | null;
  reroot_premium_until?: string | null;
  created_at?: string | null;
};

export type EverittosSubscription = {
  id: string;
  user_id: string | null;
  email: string;
  plan: 'pro' | 'business';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_session_id: string | null;
  status: string;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};
