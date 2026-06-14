export const OUTBOUND_DOC_TYPES = ['review', 'proposal', 'estimate', 'invoice', 'message'] as const;
export type OutboundDocType = (typeof OUTBOUND_DOC_TYPES)[number];

export const OUTBOUND_STATUSES = ['draft', 'scheduled', 'sent', 'failed'] as const;
export type OutboundStatus = (typeof OUTBOUND_STATUSES)[number];

export type OutboundTab = 'sent' | 'scheduled' | 'drafts' | 'failed';

export type OutboundDocument = {
  id: string;
  organization_id: string;
  doc_type: OutboundDocType;
  status: OutboundStatus;
  recipient_email: string | null;
  recipient_name: string | null;
  subject: string | null;
  body: string | null;
  customer_id: string | null;
  job_id: string | null;
  amount: number | null;
  scheduled_at: string | null;
  sent_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  source_entity_type: string | null;
  source_entity_id: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OutboundComposerFields = {
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body: string;
  amount: string;
  customer_id: string;
  job_id: string;
  scheduled_at: string;
};

export function defaultComposerFields(docType: OutboundDocType): OutboundComposerFields {
  const defaults: Record<OutboundDocType, Partial<OutboundComposerFields>> = {
    review: {
      subject: 'We would love your feedback',
      body: 'Thank you for choosing us. We hope you had a great experience. We would love to hear your feedback. Please take a moment to complete our short feedback form.\n\nShare Feedback: https://docs.google.com/forms/d/e/1FAIpQLScKoDhMAuGu8RyvFQE9dBbrazjpGhPxm-C7lAlrdnDurGhDgQ/viewform?usp=header'
    },
    proposal: {
      subject: 'Proposal for your project',
      body: 'Please find our proposal below. Let us know if you have any questions.'
    },
    estimate: {
      subject: 'Estimate for your project',
      body: 'Here is the estimate for the work we discussed. This quote is valid for 30 days.'
    },
    invoice: {
      subject: 'Invoice for completed work',
      body: 'Thank you for your business. Please find your invoice details below.'
    },
    message: {
      subject: '',
      body: ''
    }
  };

  return {
    recipient_email: '',
    recipient_name: '',
    subject: defaults[docType].subject || '',
    body: defaults[docType].body || '',
    amount: '',
    customer_id: '',
    job_id: '',
    scheduled_at: '',
    ...defaults[docType]
  };
}

export function tabToStatus(tab: OutboundTab): OutboundStatus | OutboundStatus[] {
  if (tab === 'drafts') return 'draft';
  return tab;
}

export function docTypeLabel(docType: OutboundDocType): string {
  const labels: Record<OutboundDocType, string> = {
    review: 'Review request',
    proposal: 'Proposal',
    estimate: 'Estimate',
    invoice: 'Invoice',
    message: 'Message'
  };
  return labels[docType];
}
