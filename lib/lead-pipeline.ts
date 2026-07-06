export const LEAD_PIPELINE_STAGES = [
  { value: 'open', label: 'Open' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal_sent', label: 'Proposal sent' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
  { value: 'closed_lost', label: 'Closed lost' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'reopened', label: 'Reopened' }
] as const;

export const OPEN_LEAD_STAGES = ['open', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'reopened'] as const;
export const CLOSED_LEAD_STAGES = ['won', 'closed_lost', 'cancelled'] as const;

export function leadPipelineLabel(value: string | null | undefined): string {
  if (value === 'lead') return 'Open';
  if (value === 'lost') return 'Closed lost';
  const match = LEAD_PIPELINE_STAGES.find((s) => s.value === value);
  return match?.label || value || 'Open';
}

export function normalizeLeadStage(value: string | null | undefined): string {
  if (!value || value === 'lead') return 'open';
  if (value === 'lost') return 'closed_lost';
  return value;
}

export function isClosedLeadStage(value: string | null | undefined): boolean {
  return CLOSED_LEAD_STAGES.includes(normalizeLeadStage(value) as (typeof CLOSED_LEAD_STAGES)[number]);
}
