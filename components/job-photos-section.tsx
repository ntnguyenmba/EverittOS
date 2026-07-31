'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PhotoComparisonSection } from '@/components/before-after-comparison';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FEEDBACK } from '@/lib/feedback-labels';
import { EmptyState } from '@/components/empty-state';
import { EMPTY_COPY } from '@/lib/empty-copy';
import { compressImageFile } from '@/lib/image-compress';
import { JOB_PHOTO_TAGS, type JobPhotoTag } from '@/lib/job-photo-tags';
import type { JobPhotoView } from '@/lib/job-photos-types';
import {
  fetchJobPhotosWithUrls,
  insertJobPhotoRow,
  resolvePhotoType
} from '@/lib/job-photos-client';
import { normalizePlan, photoUploadAllowed, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchUsageCounts, photoLimitReached, limitMessage } from '@/lib/everittos-usage';
import { normalizeRole, isManagerRole } from '@/lib/roles';
import { logClientActivity } from '@/lib/activity';
import { formatSupabaseError } from '@/lib/action-messages';
import { getJobFinanceCopy } from '@/lib/i18n/job-finance-copy';
import { useTranslation } from '@/components/locale-provider';
import { buildSafePhotoStoragePath, validateImageUpload } from '@/lib/upload-security';
import { isNativePlatform } from '@/lib/platform/detect';
import { pickJobPhotoFromCamera, pickJobPhotoFromLibrary } from '@/lib/platform/upload';
import { supabase } from '@/lib/supabase';

const PRIMARY_PHOTO_TYPES: JobPhotoTag[] = ['before', 'after'];

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

type UploadProgress = {
  current: number;
  total: number;
  step: 'compressing' | 'uploading' | 'saving';
  fileName: string;
};

function formatPhotoWhen(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

function formatFileSize(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [visibilityBusyId, setVisibilityBusyId] = useState<string | null>(null);
  const appFeedback = useAppFeedback();
  const { locale } = useTranslation();
  const financeCopy = getJobFinanceCopy(locale);
  const [activeTag, setActiveTag] = useState<JobPhotoTag>('before');
  const [dragOverTag, setDragOverTag] = useState<JobPhotoTag | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [canDeleteAny, setCanDeleteAny] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const normalizedPlan = normalizePlan(plan);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    const { photos: loaded, error } = await fetchJobPhotosWithUrls(supabase, jobId);
    if (error) {
      appFeedback.error(formatSupabaseError({ message: error }));
      setLoading(false);
      return;
    }
    setPhotos(loaded);
    setLoading(false);
  }, [appFeedback, jobId]);

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
    if (!files?.length || readOnly || !canUpload || uploading) return;

    const fileList = Array.from(files);
    setUploading(true);

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      setUploading(false);
      appFeedback.error('Sign in to upload photos.');
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
      appFeedback.error('Photo uploads are not available on your plan.');
      return;
    }

    let usage = await fetchUsageCounts(user.id, organizationId);
    const uploaderName = profile?.full_name || profile?.email || user.email || 'Team member';
    let uploadedCount = 0;

    for (let index = 0; index < fileList.length; index += 1) {
      const rawFile = fileList[index];
      if (photoLimitReached(userPlan, usage)) {
        appFeedback.error(limitMessage('photos', userPlan));
        break;
      }

      const validation = validateImageUpload(rawFile);
      if (!validation.ok) {
        appFeedback.error(validation.error);
        continue;
      }

      setUploadProgress({
        current: index + 1,
        total: fileList.length,
        step: 'compressing',
        fileName: rawFile.name
      });

      const file = await compressImageFile(rawFile);
      const revalidation = validateImageUpload(file);
      if (!revalidation.ok) {
        appFeedback.error(revalidation.error);
        continue;
      }

      const path = buildSafePhotoStoragePath(user.id, jobId, revalidation.extension);
      const fileName = file.name || `${revalidation.sanitizedBaseName}.${revalidation.extension}`;

      setUploadProgress({
        current: index + 1,
        total: fileList.length,
        step: 'uploading',
        fileName
      });

      const { error: uploadError } = await supabase.storage.from('job-photos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg'
      });

      if (uploadError) {
        appFeedback.error(uploadError.message);
        continue;
      }

      setUploadProgress({
        current: index + 1,
        total: fileList.length,
        step: 'saving',
        fileName
      });

      const { data: inserted, error: rowError } = await insertJobPhotoRow(supabase, {
        userId: user.id,
        jobId,
        organizationId,
        storagePath: path,
        photoType: tag,
        fileName,
        uploaderDisplayName: uploaderName,
        fileSizeBytes: file.size,
        mimeType: file.type || 'image/jpeg'
      });

      if (rowError) {
        appFeedback.error(formatSupabaseError({ message: rowError }));
        await supabase.storage.from('job-photos').remove([path]);
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      const optimistic: JobPhotoView = {
        ...(inserted as JobPhotoView),
        label: tag,
        photo_type: tag,
        url: previewUrl
      };
      setPhotos((prev) => [optimistic, ...prev]);

      if (organizationId) {
        await logClientActivity(organizationId, 'job', jobId, 'photo_uploaded', `Uploaded ${tag} photo`, {
          label: tag,
          photo_type: tag
        });
      }

      usage = { ...usage, photos: usage.photos + 1 };
      uploadedCount += 1;

      void fetchJobPhotosWithUrls(supabase, jobId).then(({ photos: refreshed }) => {
        setPhotos(refreshed);
        URL.revokeObjectURL(previewUrl);
      });
    }

    setUploading(false);
    setUploadProgress(null);

    if (uploadedCount > 0) {
      appFeedback.uploadComplete();
      onChange?.();
    }
  }

  async function toggleCustomerVisible(photoId: string, nextVisible: boolean) {
    if (visibilityBusyId || readOnly) return;
    setVisibilityBusyId(photoId);
    const res = await fetch(`/api/jobs/${jobId}/photos/${photoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_visible: nextVisible })
    });
    const json = await res.json().catch(() => ({}));
    setVisibilityBusyId(null);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to update photo visibility.');
      return;
    }
    setPhotos((prev) =>
      prev.map((photo) =>
        photo.id === photoId ? { ...photo, customer_visible: nextVisible } : photo
      )
    );
    appFeedback.success(financeCopy.photoVisibilitySaved);
    onChange?.();
  }

  function photoCategoryLabel(tag: JobPhotoTag) {
    if (tag === 'before') return financeCopy.photoBefore;
    if (tag === 'after') return financeCopy.photoAfter;
    return financeCopy.photoProgress;
  }

  function sectionTitle(tag: JobPhotoTag, count: number) {
    const label =
      tag === 'before' ? 'Before photos' : tag === 'after' ? 'After photos' : 'Progress photos';
    return count > 0 ? `${label} (${count})` : label;
  }

  function actionLabels(tag: JobPhotoTag) {
    if (tag === 'before') {
      return { camera: 'Take before photo', library: 'Choose before photos' };
    }
    if (tag === 'after') {
      return { camera: 'Take after photo', library: 'Choose after photos' };
    }
    return { camera: 'Take progress photo', library: 'Add progress photos' };
  }

  async function deletePhoto(photoId: string) {
    if (deletingId) return;
    setDeletingId(photoId);
    const res = await fetch(`/api/jobs/${jobId}/photos?photoId=${encodeURIComponent(photoId)}`, {
      method: 'DELETE'
    });
    const json = await res.json();
    setDeletingId(null);
    setConfirmDeleteId(null);

    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to delete photo.');
      return;
    }

    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    appFeedback.label('removed');
    onChange?.();
  }

  function openLibraryPicker(tag: JobPhotoTag) {
    setActiveTag(tag);
    libraryInputRef.current?.click();
  }

  function openCameraPicker(tag: JobPhotoTag) {
    setActiveTag(tag);
    cameraInputRef.current?.click();
  }

  async function openNativeCamera(tag: JobPhotoTag) {
    setActiveTag(tag);
    const result = await pickJobPhotoFromCamera();
    if (!result.ok) {
      if (result.code !== 'cancelled') {
        appFeedback.error(result.error);
      }
      return;
    }
    await uploadFiles(result.files, tag);
  }

  async function openNativeLibrary(tag: JobPhotoTag) {
    setActiveTag(tag);
    const result = await pickJobPhotoFromLibrary();
    if (!result.ok) {
      if (result.code !== 'cancelled') {
        appFeedback.error(result.error);
      }
      return;
    }
    if (result.skippedInvalid) {
      appFeedback.error(`${result.skippedInvalid} file(s) could not be used and were skipped.`);
    }
    await uploadFiles(result.files, tag);
  }

  function onDrop(event: React.DragEvent, tag: JobPhotoTag) {
    event.preventDefault();
    setDragOverTag(null);
    if (readOnly || !canUpload) return;
    void uploadFiles(event.dataTransfer.files, tag);
  }

  const uploadEnabled = canUpload && !readOnly && photoUploadAllowed(normalizedPlan);

  const grouped = JOB_PHOTO_TAGS.map((tag) => ({
    tag,
    items: photos.filter((p) => resolvePhotoType(p) === tag)
  }));
  const orderedPhotos = grouped.flatMap(({ items }) => items);
  const previewPhoto = previewIndex !== null ? orderedPhotos[previewIndex] : null;

  const progressLabel = uploadProgress
    ? uploadProgress.step === 'compressing'
      ? `Compressing ${uploadProgress.current} of ${uploadProgress.total}: ${uploadProgress.fileName}`
      : uploadProgress.step === 'uploading'
        ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}: ${uploadProgress.fileName}`
        : `Saving ${uploadProgress.current} of ${uploadProgress.total}…`
    : null;

  const uploadTags: JobPhotoTag[] = [...PRIMARY_PHOTO_TYPES, 'progress'];

  return (
    <section className="job-photos-section" aria-label="Job photos">
      {showComparison && photos.length > 0 ? <PhotoComparisonSection photos={photos} /> : null}

      {uploadEnabled ? (
        <div className="before-after-upload-grid">
          {uploadTags.map((tag) => {
            const labels = actionLabels(tag);
            const count = photos.filter((photo) => resolvePhotoType(photo) === tag).length;
            return (
              <div
                key={tag}
                className={`photo-dropzone photo-dropzone-${tag}${dragOverTag === tag ? ' photo-dropzone-active' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverTag(tag);
                  setActiveTag(tag);
                }}
                onDragLeave={() => setDragOverTag(null)}
                onDrop={(e) => onDrop(e, tag)}
              >
                <p className="photo-dropzone-title">{sectionTitle(tag, count)}</p>
                <p className="muted">
                  {tag === 'progress'
                    ? 'Optional photos during the job. Large files are compressed automatically.'
                    : 'Drag images here, take a photo, or choose from your library.'}
                </p>
                <button
                  type="button"
                  className="btn btn-primary photo-capture-btn"
                  disabled={uploading}
                  onClick={() => (isNativePlatform() ? void openNativeCamera(tag) : openCameraPicker(tag))}
                >
                  {uploading && activeTag === tag ? FEEDBACK.loading : labels.camera}
                </button>
                <button
                  type="button"
                  className="btn photo-capture-btn"
                  disabled={uploading}
                  onClick={() => (isNativePlatform() ? void openNativeLibrary(tag) : openLibraryPicker(tag))}
                >
                  {labels.library}
                </button>
              </div>
            );
          })}

          {/* Library: multiple selection, no forced camera capture (iPhone Albums). */}
          <input
            ref={libraryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="photo-file-input"
            disabled={uploading}
            onChange={(e) => {
              void uploadFiles(e.target.files, activeTag);
              e.target.value = '';
            }}
          />
          {/* Camera: single capture when supported by the browser. */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="photo-file-input"
            disabled={uploading}
            onChange={(e) => {
              void uploadFiles(e.target.files, activeTag);
              e.target.value = '';
            }}
          />

          {progressLabel ? (
            <p className="photo-upload-status" role="status" aria-live="polite">
              {progressLabel}
            </p>
          ) : null}
        </div>
      ) : null}

      {!uploadEnabled && !readOnly ? (
        <p className="muted">Photo uploads are not available on your current plan.</p>
      ) : null}

      {!loading && photos.length > 0 && canDeleteAny ? (
        <p className="muted">{financeCopy.photoVisibilityHelper}</p>
      ) : null}

      {loading ? <p className="loading-state" role="status">Loading photos…</p> : null}

      {!loading && photos.length === 0 ? (
        <EmptyState title={EMPTY_COPY.photos.title} description={EMPTY_COPY.photos.description} />
      ) : null}

      {!loading &&
        grouped.map(({ tag, items }) =>
          items.length > 0 ? (
            <div key={tag} className="photo-tag-group">
              <h4>{sectionTitle(tag, items.length)}</h4>
              <div className="photo-grid photo-grid-large">
                {items.map((photo) => {
                  const canDelete = canDeleteAny || photo.user_id === currentUserId;
                  const photoType = resolvePhotoType(photo);
                  const absoluteIndex = orderedPhotos.findIndex((row) => row.id === photo.id);
                  return (
                    <figure key={photo.id} className="photo-thumb">
                      {photo.url ? (
                        <button
                          type="button"
                          className="photo-thumb-open"
                          onClick={() => setPreviewIndex(absoluteIndex)}
                          aria-label={`Open ${photoCategoryLabel(photoType)} photo`}
                        >
                          <img src={photo.url} alt={`${photoCategoryLabel(photoType)} photo`} loading="lazy" />
                        </button>
                      ) : (
                        <div className="before-after-empty">Preview unavailable</div>
                      )}
                      <figcaption>
                        <span className="photo-tag-pill">{photoCategoryLabel(photoType)}</span>
                        <span className="photo-tag-pill photo-visibility-pill">
                          {photo.customer_visible ? financeCopy.photoCustomerReport : financeCopy.photoInternalOnly}
                        </span>
                        <span className="photo-meta-line">{formatPhotoWhen(photo.created_at)}</span>
                        {photo.uploader_display_name ? (
                          <span className="photo-meta-line">By {photo.uploader_display_name}</span>
                        ) : null}
                        {photo.file_size_bytes ? (
                          <span className="photo-meta-line">{formatFileSize(photo.file_size_bytes)}</span>
                        ) : null}
                        {canDeleteAny && !readOnly ? (
                          <button
                            type="button"
                            className="btn photo-visibility-btn"
                            disabled={visibilityBusyId === photo.id}
                            aria-pressed={Boolean(photo.customer_visible)}
                            onClick={() => void toggleCustomerVisible(photo.id, !photo.customer_visible)}
                          >
                            {photo.customer_visible ? financeCopy.photoInternalOnly : financeCopy.photoCustomerReport}
                          </button>
                        ) : null}
                        {canDelete && !readOnly ? (
                          confirmDeleteId === photo.id ? (
                            <div className="photo-delete-confirm">
                              <p>Remove this photo?</p>
                              <button
                                type="button"
                                className="btn btn-primary photo-delete-btn"
                                disabled={deletingId === photo.id}
                                onClick={() => void deletePhoto(photo.id)}
                              >
                                {deletingId === photo.id ? FEEDBACK.loading : 'Confirm remove'}
                              </button>
                              <button
                                type="button"
                                className="btn photo-delete-btn"
                                disabled={deletingId === photo.id}
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn photo-delete-btn"
                              disabled={deletingId === photo.id}
                              onClick={() => setConfirmDeleteId(photo.id)}
                            >
                              Remove
                            </button>
                          )
                        ) : null}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            </div>
          ) : null
        )}

      {previewPhoto?.url ? (
        <div
          className="photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Photo preview"
          onClick={() => setPreviewIndex(null)}
        >
          <div className="photo-lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <div className="photo-lightbox-toolbar">
              <span>
                {photoCategoryLabel(resolvePhotoType(previewPhoto))}
                {previewPhoto.uploader_display_name ? ` · By ${previewPhoto.uploader_display_name}` : ''}
              </span>
              <button type="button" className="btn" onClick={() => setPreviewIndex(null)}>
                Close
              </button>
            </div>
            <img src={previewPhoto.url} alt={`${photoCategoryLabel(resolvePhotoType(previewPhoto))} photo preview`} />
            <div className="photo-lightbox-nav">
              <button
                type="button"
                className="btn"
                disabled={previewIndex === null || previewIndex <= 0}
                onClick={() => setPreviewIndex((current) => (current === null ? current : Math.max(0, current - 1)))}
              >
                Previous
              </button>
              <span className="muted">
                {(previewIndex ?? 0) + 1} of {orderedPhotos.length}
              </span>
              <button
                type="button"
                className="btn"
                disabled={previewIndex === null || previewIndex >= orderedPhotos.length - 1}
                onClick={() =>
                  setPreviewIndex((current) =>
                    current === null ? current : Math.min(orderedPhotos.length - 1, current + 1)
                  )
                }
              >
                Next
              </button>
            </div>
            <p className="muted">
              {[formatPhotoWhen(previewPhoto.created_at), formatFileSize(previewPhoto.file_size_bytes)]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
