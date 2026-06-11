import type { JobPhotoTag } from '@/lib/job-photo-tags';

export type JobPhotoRecord = {
  id: string;
  job_id: string;
  user_id: string;
  storage_path: string;
  label: JobPhotoTag | string;
  created_at: string | null;
  uploader_display_name: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
};

export type JobPhotoView = JobPhotoRecord & {
  url: string;
};
