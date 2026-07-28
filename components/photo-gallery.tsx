'use client';

import { PhotoComparisonSection } from '@/components/before-after-comparison';
import { EmptyState } from '@/components/empty-state';
import { useTranslation } from '@/components/locale-provider';
import type { Locale } from '@/lib/i18n/config';
import type { JobPhotoView } from '@/lib/job-photos-types';
import { fetchJobPhotosWithUrls, resolvePhotoType } from '@/lib/job-photos-client';
import { photoTagLabel } from '@/lib/job-photo-tags';
import { friendlyErrorMessage } from '@/lib/user-errors';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

type PhotoGalleryProps = {
  jobId: string;
  refreshKey?: number;
  showComparison?: boolean;
  showMetadata?: boolean;
  /** When false, show a message instead of photos (client portal sharing). */
  canView?: boolean;
  /** Only load photos explicitly marked for customer visibility. */
  customerOnly?: boolean;
};

type PhotoGalleryCopy = {
  notShared: string;
  loading: string;
  emptyTitle: string;
  emptyDescription: string;
  photoAlt: string;
  by: string;
};

const PHOTO_GALLERY_COPY: Record<Locale, PhotoGalleryCopy> = {
  en: {
    notShared: 'Photos are not shared for this job.',
    loading: 'Loading photos…',
    emptyTitle: 'No photos yet',
    emptyDescription: 'Before and after photos will appear here when they are shared.',
    photoAlt: 'photo',
    by: 'By'
  },
  es: {
    notShared: 'No se compartieron fotos para este trabajo.',
    loading: 'Cargando fotos…',
    emptyTitle: 'Aún no hay fotos',
    emptyDescription: 'Las fotos del antes y después aparecerán aquí cuando se compartan.',
    photoAlt: 'foto',
    by: 'Por'
  },
  vi: {
    notShared: 'Hình ảnh chưa được chia sẻ cho công việc này.',
    loading: 'Đang tải hình ảnh…',
    emptyTitle: 'Chưa có hình ảnh',
    emptyDescription: 'Hình ảnh trước và sau khi hoàn thành sẽ xuất hiện tại đây khi được chia sẻ.',
    photoAlt: 'hình ảnh',
    by: 'Bởi'
  }
};

function formatPhotoWhen(value: string | null, locale: Locale) {
  if (!value) return '';
  return new Date(value).toLocaleString(locale);
}

export function PhotoGallery({
  jobId,
  refreshKey = 0,
  showComparison = true,
  showMetadata = true,
  canView = true,
  customerOnly = false
}: PhotoGalleryProps) {
  const { locale } = useTranslation();
  const copy = PHOTO_GALLERY_COPY[locale];
  const [photos, setPhotos] = useState<JobPhotoView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!canView) {
      setPhotos([]);
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      setError('');
      const { photos: loaded, error: fetchError } = await fetchJobPhotosWithUrls(supabase, jobId, {
        customerOnly
      });
      if (fetchError) {
        setError(fetchError);
        setLoading(false);
        return;
      }
      setPhotos(loaded.filter((p) => p.url));
      setLoading(false);
    }

    void load();
  }, [jobId, refreshKey, canView, customerOnly]);

  if (!canView) {
    return <p className="muted">{copy.notShared}</p>;
  }

  if (loading) return <p className="loading-state" role="status">{copy.loading}</p>;
  if (error) {
    return (
      <p className="auth-message auth-message-error" role="alert">
        {friendlyErrorMessage(error)}
      </p>
    );
  }
  if (photos.length === 0) {
    return <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />;
  }

  return (
    <div className="photo-gallery-readonly">
      {showComparison ? <PhotoComparisonSection photos={photos} /> : null}
      <div className="photo-grid">
        {photos.map((photo) => {
          const photoType = resolvePhotoType(photo);
          return (
            <figure key={photo.id} className="photo-thumb">
              <img src={photo.url} alt={`${photoTagLabel(photoType)} ${copy.photoAlt}`} loading="lazy" />
              <figcaption>
                <span className="photo-tag-pill">{photoTagLabel(photoType)}</span>
                {showMetadata ? (
                  <>
                    <span className="photo-meta-line">{formatPhotoWhen(photo.created_at, locale)}</span>
                    {photo.uploader_display_name ? (
                      <span className="photo-meta-line">{copy.by} {photo.uploader_display_name}</span>
                    ) : null}
                    {photo.file_name ? <span className="photo-meta-line">{photo.file_name}</span> : null}
                  </>
                ) : (
                  <span className="photo-meta-line">{photoTagLabel(photoType)}</span>
                )}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
