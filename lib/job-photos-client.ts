import type { SupabaseClient } from '@supabase/supabase-js';
import type { JobPhotoTag } from '@/lib/job-photo-tags';
import type { JobPhotoRecord, JobPhotoView } from '@/lib/job-photos-types';

export const JOB_PHOTO_SELECT =
  'id, job_id, user_id, organization_id, storage_path, label, photo_type, uploaded_by, file_name, public_url, created_at, uploader_display_name, file_size_bytes, mime_type';

const SIGNED_URL_TTL_SECONDS = 3600;

export function resolvePhotoType(row: {
  photo_type?: string | null;
  label?: string | null;
}): JobPhotoTag {
  const raw = row.photo_type || row.label;
  if (raw === 'before' || raw === 'after' || raw === 'progress') return raw;
  return 'progress';
}

export async function attachSignedUrls(
  supabase: SupabaseClient,
  rows: JobPhotoRecord[]
): Promise<JobPhotoView[]> {
  return Promise.all(
    rows.map(async (row) => {
      if (row.public_url) {
        return { ...row, label: resolvePhotoType(row), url: row.public_url } as JobPhotoView;
      }
      const { data: signed, error } = await supabase.storage
        .from('job-photos')
        .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
      if (error || !signed?.signedUrl) {
        return { ...row, label: resolvePhotoType(row), url: '' } as JobPhotoView;
      }
      return { ...row, label: resolvePhotoType(row), url: signed.signedUrl } as JobPhotoView;
    })
  );
}

export async function fetchJobPhotosWithUrls(
  supabase: SupabaseClient,
  jobId: string
): Promise<{ photos: JobPhotoView[]; error: string | null }> {
  const { data, error } = await supabase
    .from('job_photos')
    .select(JOB_PHOTO_SELECT)
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  if (error) {
    return { photos: [], error: error.message };
  }

  const withUrls = await attachSignedUrls(supabase, (data || []) as JobPhotoRecord[]);
  return { photos: withUrls, error: null };
}

export type JobPhotoInsertPayload = {
  user_id: string;
  uploaded_by: string;
  job_id: string;
  organization_id: string | null;
  storage_path: string;
  photo_type: JobPhotoTag;
  label: JobPhotoTag;
  file_name: string;
  uploader_display_name: string;
  file_size_bytes: number;
  mime_type: string;
};

export function buildJobPhotoInsertPayload(input: {
  userId: string;
  jobId: string;
  organizationId: string | null | undefined;
  storagePath: string;
  photoType: JobPhotoTag;
  fileName: string;
  uploaderDisplayName: string;
  fileSizeBytes: number;
  mimeType: string;
}): JobPhotoInsertPayload {
  return {
    user_id: input.userId,
    uploaded_by: input.userId,
    job_id: input.jobId,
    organization_id: input.organizationId || null,
    storage_path: input.storagePath,
    photo_type: input.photoType,
    label: input.photoType,
    file_name: input.fileName,
    uploader_display_name: input.uploaderDisplayName,
    file_size_bytes: input.fileSizeBytes,
    mime_type: input.mimeType
  };
}
