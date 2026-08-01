'use client';

/**
 * @deprecated Use JobPhotosSection for full before/progress/after documentation.
 * Thin wrapper kept for contractor portal compatibility.
 */
import { JobPhotosSection } from '@/components/job-photos-section';
import type { EverittosPlan } from '@/lib/everittos-plans';

type PhotoUploadProps = {
  jobId: string;
  userId?: string;
  organizationId?: string | null;
  disabled?: boolean;
  plan?: EverittosPlan | string | null;
  onUploaded?: () => void;
};

export function PhotoUpload({ jobId, organizationId, disabled, plan, onUploaded }: PhotoUploadProps) {
  return (
    <JobPhotosSection
      jobId={jobId}
      organizationId={organizationId}
      canUpload={!disabled}
      plan={plan}
      onChange={onUploaded}
      showComparison={false}
    />
  );
}
