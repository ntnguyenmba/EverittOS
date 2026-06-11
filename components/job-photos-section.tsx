'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PhotoComparisonSection } from '@/components/before-after-comparison';
import { EmptyState } from '@/components/empty-state';
import { EMPTY_COPY } from '@/lib/empty-copy';
import { compressImageFile } from '@/lib/image-compress';
import { JOB_PHOTO_TAGS, photoTagLabel, type JobPhotoTag } from '@/lib/job-photo-tags';
import type { JobPhotoView } from '@/lib/job-photos-types';
import { normalizePlan, photoUploadAllowed, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchUsageCounts, photoLimitReached, limitMessage } from '@/lib/everittos-usage';
import { normalizeRole, isManagerRole } from '@/lib/roles';
import { logClientActivity } from '@/lib/activity';
import { friendlyErrorMessage } from '@/lib/user-errors';
import { supabase } from '@/lib/supabase';

type JobPhotosSectionProps = {
  jobId: string;
  organizationId?: string | null;
  canUpload?: boolean;
  plan?: EverittosPlan | string | null;
  refreshKey?: number;
  onChange?: () => void;
  readOnly?: boolean;
  showComparison?: boolean;
};

function formatPhotoWhen(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

export function JobPhotosSection({
  jobId,
  organizationId,
  canUpload = true,
  plan = 'free',
  refreshKey = 0,
  onChange,
  readOnly = false,
  showComparison = true
}: JobPhotosSectionProps) {
  const [photos, setPhotos] = useState<JobPhotoView[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [activeTag, setActiveTag] = useState<JobPhotoTag>('before');
  const [dragOver, setDragOver] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [canDeleteAny, setCanDeleteAny] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const normalizedPlan = normalizePlan(plan);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    setMessage('');

    const { data, error } = await supabase
      .from('job_photos')
      .select('id, job_id, user_id, storage_path, label, created_at, uploader_display_name, file_size_bytes, mime_type')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const rows = data || [];
    const withUrls = await Promise.all(
      rows.map(async (row) => {
        const { data: signed } = await supabase.storage.from('job-photos').createSignedUrl(row.storage_path, 3600);
        return { ...row, url: signed?.signedUrl || '' } as JobPhotoView;
      })
    );

    setPhotos(withUrls.filter((p) => p.url));
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    async function init() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
        setCanDeleteAny(isManagerRole(normalizeRole(profile?.role)));
      }
    }
    void init();
    void loadPhotos();
  }, [jobId, refreshKey, loadPhotos]);

  async function uploadFiles(files: FileList | File[] | null, tag: JobPhotoTag) {
    if (!files?.length || readOnly || !canUpload) return;

    setUploading(true);
    setMessage('');

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      setUploading(false);
      setMessage('Sign in to upload photos.');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, full_name, email')
      .eq('id', user.id)
      .maybeSingle();
    const userPlan = normalizePlan(profile?.plan);
    if (!photoUploadAllowed(userPlan)) {
      setUploading(false);
      setMessage('Photo uploads are not available on your plan.');
      return;
    }

    let usage = await fetchUsageCounts(user.id, organizationId);
    const uploaderName = profile?.full_name || profile?.email || user.email || 'Team member';

    for (const rawFile of Array.from(files)) {
      if (photoLimitReached(userPlan, usage)) {
        setMessage(limitMessage('photos', userPlan));
        break;
      }

      const file = await compressImageFile(rawFile);
      const ext = file.type === 'image/png' ? 'png' : 'jpg';
      const path = `${user.id}/${jobId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage.from('job-photos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg'
      });

      if (uploadError) {
        setMessage(uploadError.message);
        continue;
      }

      const { error: rowError } = await supabase.from('job_photos').insert({
        user_id: user.id,
        job_id: jobId,
        organization_id: organizationId,
        storage_path: path,
        label: tag,
        uploader_display_name: uploaderName,
        file_size_bytes: file.size,
        mime_type: file.type || 'image/jpeg'
      });

      if (rowError) {
        setMessage(rowError.message);
        await supabase.storage.from('job-photos').remove([path]);
        continue;
      }

      if (organizationId) {
        await logClientActivity(organizationId, 'job', jobId, 'photo_uploaded', `Uploaded ${tag} photo`, {
          label: tag
        });
      }

      usage = { ...usage, photos: usage.photos + 1 };
    }

    setUploading(false);
    await loadPhotos();
    onChange?.();
  }

  async function deletePhoto(photoId: string) {
    setDeletingId(photoId);
    setMessage('');
    const res = await fetch(`/api/jobs/${jobId}/photos?photoId=${encodeURIComponent(photoId)}`, {
      method: 'DELETE'
    });
    const json = await res.json();
    setDeletingId(null);
    if (!res.ok) {
      setMessage(json.error || 'Unable to delete photo.');
      return;
    }
    await loadPhotos();
    onChange?.();
  }

  function openFilePicker(tag: JobPhotoTag) {
    setActiveTag(tag);
    fileInputRef.current?.click();
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(false);
    if (readOnly || !canUpload) return;
    void uploadFiles(event.dataTransfer.files, activeTag);
  }

  const uploadEnabled = canUpload && !readOnly && photoUploadAllowed(normalizedPlan);
  const grouped = JOB_PHOTO_TAGS.map((tag) => ({
    tag,
    items: photos.filter((p) => p.label === tag)
  }));

  return (
    <section className="job-photos-section" aria-label="Job photo documentation">
      {showComparison && photos.length > 0 ? <PhotoComparisonSection photos={photos} /> : null}

      {uploadEnabled ? (
        <div
          className={`photo-dropzone${dragOver ? ' photo-dropzone-active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <p className="photo-dropzone-title">Add photos</p>
          <p className="muted">Drag and drop images here, or use the buttons below — works on phone and desktop.</p>

          <div className="photo-capture-buttons" role="group" aria-label="Photo category">
            {JOB_PHOTO_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`btn photo-capture-btn${activeTag === tag ? ' btn-primary' : ''}`}
                disabled={uploading}
                onClick={() => openFilePicker(tag)}
              >
                {photoTagLabel(tag)}
              </button>
            ))}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="photo-file-input"
            disabled={uploading}
            onChange={(e) => {
              void uploadFiles(e.target.files, activeTag);
              e.target.value = '';
            }}
          />

          <p className="photo-upload-status">{uploading ? 'Uploading and compressing…' : `Selected category: ${photoTagLabel(activeTag)}`}</p>
        </div>
      ) : null}

      {loading ? <p className="loading-state" role="status">Loading photos…</p> : null}

      {!loading && photos.length === 0 ? (
        <EmptyState title={EMPTY_COPY.photos.title} description={EMPTY_COPY.photos.description} />
      ) : null}

      {!loading &&
        grouped.map(({ tag, items }) =>
          items.length > 0 ? (
            <div key={tag} className="photo-tag-group">
              <h4>{photoTagLabel(tag)}</h4>
              <div className="photo-grid">
                {items.map((photo) => {
                  const canDelete = canDeleteAny || photo.user_id === currentUserId;
                  return (
                    <figure key={photo.id} className="photo-thumb">
                      <img src={photo.url} alt={`${photoTagLabel(tag)} photo`} loading="lazy" />
                      <figcaption>
                        <span className="photo-tag-pill">{photoTagLabel(tag)}</span>
                        <span className="photo-meta-line">{formatPhotoWhen(photo.created_at)}</span>
                        {photo.uploader_display_name ? (
                          <span className="photo-meta-line">By {photo.uploader_display_name}</span>
                        ) : null}
                        {canDelete && !readOnly ? (
                          <button
                            type="button"
                            className="btn photo-delete-btn"
                            disabled={deletingId === photo.id}
                            onClick={() => void deletePhoto(photo.id)}
                          >
                            {deletingId === photo.id ? 'Removing…' : 'Remove'}
                          </button>
                        ) : null}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            </div>
          ) : null
        )}

      {message ? (
        <p className="auth-message auth-message-error" role="alert">
          {friendlyErrorMessage(message)}
        </p>
      ) : null}
    </section>
  );
}
