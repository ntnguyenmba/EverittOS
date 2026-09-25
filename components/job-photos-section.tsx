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
import { fetchJobPhotosWithUrls, insertJobPhotoRow, resolvePhotoType } from '@/lib/job-photos-client';
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

const photoCopy = {
  en: {
    signIn: 'Sign in to upload photos.', unavailable: 'Photo uploads are not available on your plan.', teamMember: 'Team member',
    visibilityError: 'Could not update photo visibility.', deleteError: 'Could not remove photo.', skipped: (count: number) => `${count} file(s) could not be used and were skipped.`,
    beforePhotos: 'Before photos', afterPhotos: 'After photos', progressPhotos: 'Progress photos',
    takeBefore: 'Take before photo', chooseBefore: 'Choose before photos', takeAfter: 'Take after photo', chooseAfter: 'Choose after photos',
    takeProgress: 'Take progress photo', chooseProgress: 'Add progress photos', progressHelp: 'Optional photos during the job. Large files are compressed automatically.',
    uploadHelp: 'Drag images here, take a photo, or choose from your library.', planHelp: 'Photo uploads are not available on your current plan.', loading: 'Loading photos...',
    compressing: (current: number, total: number, name: string) => `Compressing ${current} of ${total}: ${name}`,
    uploading: (current: number, total: number, name: string) => `Uploading ${current} of ${total}: ${name}`,
    saving: (current: number, total: number) => `Saving ${current} of ${total}...`, previewUnavailable: 'Preview unavailable', by: 'By',
    openPhoto: (label: string) => `Open ${label} photo`, photoAlt: (label: string) => `${label} photo`, removeConfirm: 'Remove this photo?',
    confirmRemove: 'Confirm remove', cancel: 'Cancel', remove: 'Remove', preview: 'Photo preview', close: 'Close', previous: 'Previous', next: 'Next',
    of: 'of', previewAlt: (label: string) => `${label} photo preview`, ariaLabel: 'Job photos'
  },
  es: {
    signIn: 'Inicia sesión para subir fotos.', unavailable: 'La carga de fotos no está disponible en tu plan.', teamMember: 'Miembro del equipo',
    visibilityError: 'No se pudo actualizar la visibilidad de la foto.', deleteError: 'No se pudo eliminar la foto.', skipped: (count: number) => `${count} archivo(s) no se pudieron usar y se omitieron.`,
    beforePhotos: 'Fotos de antes', afterPhotos: 'Fotos de después', progressPhotos: 'Fotos del progreso',
    takeBefore: 'Tomar foto de antes', chooseBefore: 'Elegir fotos de antes', takeAfter: 'Tomar foto de después', chooseAfter: 'Elegir fotos de después',
    takeProgress: 'Tomar foto del progreso', chooseProgress: 'Agregar fotos del progreso', progressHelp: 'Fotos opcionales durante el trabajo. Los archivos grandes se comprimen automáticamente.',
    uploadHelp: 'Arrastra imágenes aquí, toma una foto o elige de tu galería.', planHelp: 'La carga de fotos no está disponible en tu plan actual.', loading: 'Cargando fotos...',
    compressing: (current: number, total: number, name: string) => `Comprimiendo ${current} de ${total}: ${name}`,
    uploading: (current: number, total: number, name: string) => `Subiendo ${current} de ${total}: ${name}`,
    saving: (current: number, total: number) => `Guardando ${current} de ${total}...`, previewUnavailable: 'Vista previa no disponible', by: 'Por',
    openPhoto: (label: string) => `Abrir foto ${label}`, photoAlt: (label: string) => `Foto ${label}`, removeConfirm: '¿Eliminar esta foto?',
    confirmRemove: 'Confirmar eliminación', cancel: 'Cancelar', remove: 'Eliminar', preview: 'Vista previa de la foto', close: 'Cerrar', previous: 'Anterior', next: 'Siguiente',
    of: 'de', previewAlt: (label: string) => `Vista previa de foto ${label}`, ariaLabel: 'Fotos del trabajo'
  },
  vi: {
    signIn: 'Đăng nhập để tải ảnh lên.', unavailable: 'Gói của bạn không hỗ trợ tải ảnh.', teamMember: 'Thành viên nhóm',
    visibilityError: 'Không thể cập nhật quyền xem ảnh.', deleteError: 'Không thể xóa ảnh.', skipped: (count: number) => `${count} tệp không thể sử dụng và đã được bỏ qua.`,
    beforePhotos: 'Ảnh trước khi làm', afterPhotos: 'Ảnh sau khi làm', progressPhotos: 'Ảnh tiến độ',
    takeBefore: 'Chụp ảnh trước khi làm', chooseBefore: 'Chọn ảnh trước khi làm', takeAfter: 'Chụp ảnh sau khi làm', chooseAfter: 'Chọn ảnh sau khi làm',
    takeProgress: 'Chụp ảnh tiến độ', chooseProgress: 'Thêm ảnh tiến độ', progressHelp: 'Ảnh tùy chọn trong khi làm. Tệp lớn sẽ tự động được nén.',
    uploadHelp: 'Kéo ảnh vào đây, chụp ảnh hoặc chọn từ thư viện.', planHelp: 'Gói hiện tại không hỗ trợ tải ảnh.', loading: 'Đang tải ảnh...',
    compressing: (current: number, total: number, name: string) => `Đang nén ${current}/${total}: ${name}`,
    uploading: (current: number, total: number, name: string) => `Đang tải lên ${current}/${total}: ${name}`,
    saving: (current: number, total: number) => `Đang lưu ${current}/${total}...`, previewUnavailable: 'Không có bản xem trước', by: 'Bởi',
    openPhoto: (label: string) => `Mở ảnh ${label}`, photoAlt: (label: string) => `Ảnh ${label}`, removeConfirm: 'Xóa ảnh này?',
    confirmRemove: 'Xác nhận xóa', cancel: 'Hủy', remove: 'Xóa', preview: 'Xem trước ảnh', close: 'Đóng', previous: 'Trước', next: 'Tiếp',
    of: 'trên', previewAlt: (label: string) => `Xem trước ảnh ${label}`, ariaLabel: 'Ảnh công việc'
  }
} as const;

function formatPhotoWhen(value: string | null, locale: string) {
  if (!value) return '';
  return new Date(value).toLocaleString(locale);
}

function formatFileSize(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function JobPhotosSection({
  jobId, organizationId, canUpload = true, plan = 'free', refreshKey = 0, onChange, readOnly = false, showComparison = true
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
  const ui = photoCopy[locale] || photoCopy.en;
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
      const { data: { user } } = await supabase.auth.getUser();
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setUploading(false);
      appFeedback.error(ui.signIn);
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('plan, full_name, email').eq('id', user.id).maybeSingle();
    const userPlan = normalizePlan(profile?.plan);
    if (!photoUploadAllowed(userPlan)) {
      setUploading(false);
      appFeedback.error(ui.unavailable);
      return;
    }

    let usage = await fetchUsageCounts(user.id, organizationId);
    const uploaderName = profile?.full_name || profile?.email || user.email || ui.teamMember;
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
      setUploadProgress({ current: index + 1, total: fileList.length, step: 'compressing', fileName: rawFile.name });
      const file = await compressImageFile(rawFile);
      const revalidation = validateImageUpload(file);
      if (!revalidation.ok) {
        appFeedback.error(revalidation.error);
        continue;
      }
      const path = buildSafePhotoStoragePath(user.id, jobId, revalidation.extension);
      const fileName = file.name || `${revalidation.sanitizedBaseName}.${revalidation.extension}`;
      setUploadProgress({ current: index + 1, total: fileList.length, step: 'uploading', fileName });
      const { error: uploadError } = await supabase.storage.from('job-photos').upload(path, file, {
        cacheControl: '3600', upsert: false, contentType: file.type || 'image/jpeg'
      });
      if (uploadError) {
        appFeedback.error(uploadError.message);
        continue;
      }
      setUploadProgress({ current: index + 1, total: fileList.length, step: 'saving', fileName });
      const { data: inserted, error: rowError } = await insertJobPhotoRow(supabase, {
        userId: user.id, jobId, organizationId, storagePath: path, photoType: tag, fileName,
        uploaderDisplayName: uploaderName, fileSizeBytes: file.size, mimeType: file.type || 'image/jpeg'
      });
      if (rowError) {
        appFeedback.error(formatSupabaseError({ message: rowError }));
        await supabase.storage.from('job-photos').remove([path]);
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      setPhotos((prev) => [{ ...(inserted as JobPhotoView), label: tag, photo_type: tag, url: previewUrl }, ...prev]);
      if (organizationId) {
        await logClientActivity(organizationId, 'job', jobId, 'photo_uploaded', `${photoCategoryLabel(tag)}: ${fileName}`, { label: tag, photo_type: tag });
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
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_visible: nextVisible })
    });
    const json = await res.json().catch(() => ({}));
    setVisibilityBusyId(null);
    if (!res.ok) {
      appFeedback.error(json.error || ui.visibilityError);
      return;
    }
    setPhotos((prev) => prev.map((photo) => photo.id === photoId ? { ...photo, customer_visible: nextVisible } : photo));
    appFeedback.success(financeCopy.photoVisibilitySaved);
    onChange?.();
  }

  function photoCategoryLabel(tag: JobPhotoTag) {
    if (tag === 'before') return financeCopy.photoBefore;
    if (tag === 'after') return financeCopy.photoAfter;
    return financeCopy.photoProgress;
  }

  function sectionTitle(tag: JobPhotoTag, count: number) {
    const label = tag === 'before' ? ui.beforePhotos : tag === 'after' ? ui.afterPhotos : ui.progressPhotos;
    return count > 0 ? `${label} (${count})` : label;
  }

  function actionLabels(tag: JobPhotoTag) {
    if (tag === 'before') return { camera: ui.takeBefore, library: ui.chooseBefore };
    if (tag === 'after') return { camera: ui.takeAfter, library: ui.chooseAfter };
    return { camera: ui.takeProgress, library: ui.chooseProgress };
  }

  async function deletePhoto(photoId: string) {
    if (deletingId) return;
    setDeletingId(photoId);
    const res = await fetch(`/api/jobs/${jobId}/photos?photoId=${encodeURIComponent(photoId)}`, { method: 'DELETE' });
    const json = await res.json();
    setDeletingId(null);
    setConfirmDeleteId(null);
    if (!res.ok) {
      appFeedback.error(json.error || ui.deleteError);
      return;
    }
    setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
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
      if (result.code !== 'cancelled') appFeedback.error(result.error);
      return;
    }
    await uploadFiles(result.files, tag);
  }

  async function openNativeLibrary(tag: JobPhotoTag) {
    setActiveTag(tag);
    const result = await pickJobPhotoFromLibrary();
    if (!result.ok) {
      if (result.code !== 'cancelled') appFeedback.error(result.error);
      return;
    }
    if (result.skippedInvalid) appFeedback.error(ui.skipped(result.skippedInvalid));
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
    items: photos.filter((photo) => resolvePhotoType(photo) === tag).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  }));
  const orderedPhotos = grouped.flatMap(({ items }) => items);
  const previewPhoto = previewIndex !== null ? orderedPhotos[previewIndex] : null;
  const progressLabel = uploadProgress
    ? uploadProgress.step === 'compressing'
      ? ui.compressing(uploadProgress.current, uploadProgress.total, uploadProgress.fileName)
      : uploadProgress.step === 'uploading'
        ? ui.uploading(uploadProgress.current, uploadProgress.total, uploadProgress.fileName)
        : ui.saving(uploadProgress.current, uploadProgress.total)
    : null;
  const uploadTags: JobPhotoTag[] = [...PRIMARY_PHOTO_TYPES, 'progress'];

  return (
    <section className="job-photos-section" aria-label={ui.ariaLabel}>
      {showComparison && photos.length > 0 ? <PhotoComparisonSection photos={photos} /> : null}
      {uploadEnabled ? (
        <div className="before-after-upload-grid">
          {uploadTags.map((tag) => {
            const labels = actionLabels(tag);
            const count = photos.filter((photo) => resolvePhotoType(photo) === tag).length;
            return (
              <div key={tag} className={`photo-dropzone photo-dropzone-${tag}${dragOverTag === tag ? ' photo-dropzone-active' : ''}`}
                onDragOver={(event) => { event.preventDefault(); setDragOverTag(tag); setActiveTag(tag); }}
                onDragLeave={() => setDragOverTag(null)} onDrop={(event) => onDrop(event, tag)}>
                <p className="photo-dropzone-title">{sectionTitle(tag, count)}</p>
                <p className="muted">{tag === 'progress' ? ui.progressHelp : ui.uploadHelp}</p>
                <div className="action-row photo-capture-actions">
                  <button type="button" className="btn btn-primary photo-capture-btn" disabled={uploading}
                    onClick={() => (isNativePlatform() ? void openNativeCamera(tag) : openCameraPicker(tag))}>
                    {uploading && activeTag === tag ? FEEDBACK.loading : labels.camera}
                  </button>
                  <button type="button" className="btn photo-capture-btn" disabled={uploading}
                    onClick={() => (isNativePlatform() ? void openNativeLibrary(tag) : openLibraryPicker(tag))}>{labels.library}</button>
                </div>
              </div>
            );
          })}
          <input ref={libraryInputRef} type="file" accept="image/*" multiple className="photo-file-input" disabled={uploading}
            onChange={(event) => { void uploadFiles(event.target.files, activeTag); event.target.value = ''; }} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="photo-file-input" disabled={uploading}
            onChange={(event) => { void uploadFiles(event.target.files, activeTag); event.target.value = ''; }} />
          {progressLabel ? <p className="photo-upload-status" role="status" aria-live="polite">{progressLabel}</p> : null}
        </div>
      ) : null}

      {!uploadEnabled && !readOnly ? <p className="muted">{ui.planHelp}</p> : null}
      {!loading && photos.length > 0 && canDeleteAny ? <p className="muted">{financeCopy.photoVisibilityHelper}</p> : null}
      {loading ? <p className="loading-state" role="status">{ui.loading}</p> : null}
      {!loading && photos.length === 0 ? <EmptyState title={EMPTY_COPY.photos.title} description={EMPTY_COPY.photos.description} /> : null}

      {!loading && grouped.map(({ tag, items }) => items.length > 0 ? (
        <div key={tag} className="photo-tag-group">
          <h4>{sectionTitle(tag, items.length)}</h4>
          <div className="photo-grid photo-grid-large">
            {items.map((photo) => {
              const canDelete = canDeleteAny || photo.user_id === currentUserId;
              const photoType = resolvePhotoType(photo);
              const absoluteIndex = orderedPhotos.findIndex((row) => row.id === photo.id);
              const label = photoCategoryLabel(photoType);
              return (
                <figure key={photo.id} className="photo-thumb">
                  {photo.url ? (
                    <button type="button" className="photo-thumb-open" onClick={() => setPreviewIndex(absoluteIndex)} aria-label={ui.openPhoto(label)}>
                      <img src={photo.url} alt={ui.photoAlt(label)} loading="lazy" />
                    </button>
                  ) : <div className="before-after-empty">{ui.previewUnavailable}</div>}
                  <figcaption>
                    <span className="photo-tag-pill">{label}</span>
                    <span className="photo-tag-pill photo-visibility-pill">{photo.customer_visible ? financeCopy.photoCustomerReport : financeCopy.photoInternalOnly}</span>
                    <span className="photo-meta-line">{formatPhotoWhen(photo.created_at, locale)}</span>
                    {photo.uploader_display_name ? <span className="photo-meta-line">{ui.by} {photo.uploader_display_name}</span> : null}
                    {photo.file_size_bytes ? <span className="photo-meta-line">{formatFileSize(photo.file_size_bytes)}</span> : null}
                    {canDeleteAny && !readOnly ? (
                      <button type="button" className="btn photo-visibility-btn" disabled={visibilityBusyId === photo.id}
                        aria-pressed={Boolean(photo.customer_visible)} onClick={() => void toggleCustomerVisible(photo.id, !photo.customer_visible)}>
                        {photo.customer_visible ? financeCopy.photoInternalOnly : financeCopy.photoCustomerReport}
                      </button>
                    ) : null}
                    {canDelete && !readOnly ? confirmDeleteId === photo.id ? (
                      <div className="photo-delete-confirm">
                        <p>{ui.removeConfirm}</p>
                        <button type="button" className="btn btn-primary photo-delete-btn" disabled={deletingId === photo.id} onClick={() => void deletePhoto(photo.id)}>
                          {deletingId === photo.id ? FEEDBACK.loading : ui.confirmRemove}
                        </button>
                        <button type="button" className="btn photo-delete-btn" disabled={deletingId === photo.id} onClick={() => setConfirmDeleteId(null)}>{ui.cancel}</button>
                      </div>
                    ) : (
                      <button type="button" className="btn photo-delete-btn" disabled={deletingId === photo.id} onClick={() => setConfirmDeleteId(photo.id)}>{ui.remove}</button>
                    ) : null}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      ) : null)}

      {previewPhoto?.url ? (
        <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label={ui.preview} onClick={() => setPreviewIndex(null)}>
          <div className="photo-lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <div className="photo-lightbox-toolbar">
              <span>{photoCategoryLabel(resolvePhotoType(previewPhoto))}{previewPhoto.uploader_display_name ? ` · ${ui.by} ${previewPhoto.uploader_display_name}` : ''}</span>
              <button type="button" className="btn" onClick={() => setPreviewIndex(null)}>{ui.close}</button>
            </div>
            <img src={previewPhoto.url} alt={ui.previewAlt(photoCategoryLabel(resolvePhotoType(previewPhoto)))} />
            <div className="photo-lightbox-nav">
              <button type="button" className="btn" disabled={previewIndex === null || previewIndex <= 0}
                onClick={() => setPreviewIndex((current) => current === null ? current : Math.max(0, current - 1))}>{ui.previous}</button>
              <span className="muted">{(previewIndex ?? 0) + 1} {ui.of} {orderedPhotos.length}</span>
              <button type="button" className="btn" disabled={previewIndex === null || previewIndex >= orderedPhotos.length - 1}
                onClick={() => setPreviewIndex((current) => current === null ? current : Math.min(orderedPhotos.length - 1, current + 1))}>{ui.next}</button>
            </div>
            <p className="muted">{[formatPhotoWhen(previewPhoto.created_at, locale), formatFileSize(previewPhoto.file_size_bytes)].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
