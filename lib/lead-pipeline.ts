export const LEAD_PIPELINE_STAGES = [
  { value: 'lead', label: 'Lead' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal_sent', label: 'Proposal sent' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' }
] as const;

export function leadPipelineLabel(value: string | null | undefined): string {
  const match = LEAD_PIPELINE_STAGES.find((s) => s.value === value);
  return match?.label || value || 'Lead';
}
