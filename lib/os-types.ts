export type PipelineStage = 'lead' | 'qualified' | 'proposal_sent' | 'negotiation' | 'won' | 'lost';
export type RecordType = 'lead' | 'contact' | 'company';
export type LeadSource =
  | 'website'
  | 'referral'
  | 'facebook'
  | 'google'
  | 'instagram'
  | 'manual'
  | 'form'
  | 'other';

export type FormType =
  | 'contact'
  | 'estimate'
  | 'lead_capture'
  | 'client_intake'
  | 'booking'
  | 'custom';

export type FormFieldType = 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'file';

export type TemplateCategory =
  | 'sop'
  | 'proposal'
  | 'contract'
  | 'estimate'
  | 'invoice'
  | 'email'
  | 'checklist'
  | 'workflow';

export type ReviewRequestStatus = 'pending' | 'sent' | 'submitted' | 'declined';

export type EverittForm = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  form_type: FormType;
  active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type EverittFormField = {
  id: string;
  form_id: string;
  field_type: FormFieldType;
  label: string;
  required: boolean;
  sort_order: number;
  options: string[] | null;
};

export type EverittTemplate = {
  id: string;
  organization_id: string;
  category: TemplateCategory;
  title: string;
  body: string;
  version: number;
  created_at: string;
  updated_at: string;
};

export type ReviewRequest = {
  id: string;
  organization_id: string;
  job_id: string | null;
  customer_id: string | null;
  status: ReviewRequestStatus;
  customer_email: string | null;
  message: string | null;
  sent_at: string | null;
  submitted_at: string | null;
  scheduled_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerReview = {
  id: string;
  organization_id: string;
  review_request_id: string | null;
  rating: number | null;
  body: string | null;
  status: string;
  created_at: string;
};

export type OrgMembership = {
  organizationId: string;
  organizationName: string;
  role: string;
  isOwner: boolean;
};

export type SearchResultItem = {
  id: string;
  type: 'customer' | 'property' | 'job' | 'invoice' | 'contractor' | 'task' | 'document' | 'template' | 'form';
  title: string;
  subtitle: string | null;
  href: string;
};
