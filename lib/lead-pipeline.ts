export const OPEN_LEAD_STAGES = ['open', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'reopened'] as const;

export const LEAD_PIPELINE_STAGES = [
  { value: 'open', label: 'Open' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal_sent', label: 'Proposal sent' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'closed_lost', label: 'Closed lost' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'reopened', label: 'Reopened' }
] as const;

export const CLOSED_LEAD_STAGES = ['won', 'closed_lost', 'cancelled'] as const;

export function leadPipelineLabel(value: string | null | undefined): string {
  if (!value || value === 'lead') return 'Open';
  if (value === 'lost') return 'Closed lost';
  if (value === 'won') return 'Converted';
  const match = LEAD_PIPELINE_STAGES.find((stage) => stage.value === value);
  return match?.label || value;
}

export function normalizeLeadStage(value: string | null | undefined): string {
  if (!value || value === 'lead') return 'open';
  if (value === 'lost') return 'closed_lost';
  return value;
}

export function isOpenLeadStage(value: string | null | undefined): boolean {
  return OPEN_LEAD_STAGES.includes(normalizeLeadStage(value) as (typeof OPEN_LEAD_STAGES)[number]);
}

export function isClosedLeadStage(value: string | null | undefined): boolean {
  return CLOSED_LEAD_STAGES.includes(normalizeLeadStage(value) as (typeof CLOSED_LEAD_STAGES)[number]);
}
