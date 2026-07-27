'use client';

import { PhotoComparisonSection } from '@/components/before-after-comparison';
import { EmptyState } from '@/components/empty-state';
import { EMPTY_COPY } from '@/lib/empty-copy';
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

function formatPhotoWhen(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

export function PhotoGallery({
  jobId,
  refreshKey = 0,
  showComparison = true,
  showMetadata = true,
  canView = true,
  customerOnly = false
}: PhotoGalleryProps) {
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
    return <p className="muted">Photos are not shared for this job.</p>;
  }

  if (loading) return <p className="loading-state" role="status">Loading photos…</p>;
  if (error) {
    return (
      <p className="auth-message auth-message-error" role="alert">
        {friendlyErrorMessage(error)}
      </p>
    );
  }
  if (photos.length === 0) {
    return <EmptyState title={EMPTY_COPY.photos.title} description={EMPTY_COPY.photos.description} />;
  }

  return (
    <div className="photo-gallery-readonly">
      {showComparison ? <PhotoComparisonSection photos={photos} /> : null}
      <div className="photo-grid">
        {photos.map((photo) => {
          const photoType = resolvePhotoType(photo);
          return (
            <figure key={photo.id} className="photo-thumb">
              <img src={photo.url} alt={`${photoTagLabel(photoType)} photo`} loading="lazy" />
              <figcaption>
                <span className="photo-tag-pill">{photoTagLabel(photoType)}</span>
                {showMetadata ? (
                  <>
                    <span className="photo-meta-line">{formatPhotoWhen(photo.created_at)}</span>
                    {photo.uploader_display_name ? (
                      <span className="photo-meta-line">By {photo.uploader_display_name}</span>
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
