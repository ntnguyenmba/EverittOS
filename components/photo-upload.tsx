'use client';

/**
 * @deprecated Use JobPhotosSection for full before/progress/after documentation.
 * Thin wrapper kept for contractor portal compatibility.
 */
import { JobPhotosSection } from '@/components/job-photos-section';

type PhotoUploadProps = {
  jobId: string;
  userId?: string;
  organizationId?: string | null;
  disabled?: boolean;
  onUploaded?: () => void;
};

export function PhotoUpload({ jobId, organizationId, disabled, onUploaded }: PhotoUploadProps) {
  return (
    <JobPhotosSection
      jobId={jobId}
      organizationId={organizationId}
      canUpload={!disabled}
      onChange={onUploaded}
      showComparison={false}
    />
  );
}
