import type { JobPhotoTag } from '@/lib/job-photo-tags';

export type JobPhotoRecord = {
  id: string;
  job_id: string;
  user_id: string;
  organization_id?: string | null;
  storage_path: string;
  label: JobPhotoTag | string;
  photo_type?: JobPhotoTag | string | null;
  uploaded_by?: string | null;
  file_name?: string | null;
  public_url?: string | null;
  created_at: string | null;
  uploader_display_name: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  customer_visible?: boolean;
  customer_caption?: string | null;
};

export type JobPhotoView = JobPhotoRecord & {
  url: string;
};
