export const STAFFING_PIPELINE_STAGES = [
  { value: 'applicant', label: 'Applicant' },
  { value: 'interview', label: 'Interview' },
  { value: 'screening', label: 'Screening' },
  { value: 'offer_sent', label: 'Offer sent' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'employee', label: 'Employee' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'rehired', label: 'Rehired' }
] as const;

export const ACTIVE_STAFFING_STAGES = ['applicant', 'interview', 'screening', 'offer_sent', 'contractor', 'employee', 'rehired'] as const;
export const CLOSED_STAFFING_STAGES = ['inactive', 'rejected'] as const;

export function staffingPipelineLabel(value: string | null | undefined): string {
  const match = STAFFING_PIPELINE_STAGES.find((stage) => stage.value === value);
  return match?.label || value || 'Applicant';
}

export function normalizeStaffingStage(value: string | null | undefined): string {
  if (value === 'background_check') return 'screening';
  return value || 'applicant';
}
