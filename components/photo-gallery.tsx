'use client';

import { PhotoComparisonSection } from '@/components/before-after-comparison';
import { EmptyState } from '@/components/empty-state';
import { useEmptyCopy } from '@/lib/i18n-client';
import type { JobPhotoView } from '@/lib/job-photos-types';
import { photoTagLabel } from '@/lib/job-photo-tags';
import { friendlyErrorMessage } from '@/lib/user-errors';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

type PhotoGalleryProps = {
  jobId: string;
  refreshKey?: number;
  showComparison?: boolean;
  showMetadata?: boolean;
};

function formatPhotoWhen(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

export function PhotoGallery({
  jobId,
  refreshKey = 0,
  showComparison = true,
  showMetadata = true
}: PhotoGalleryProps) {
  const emptyCopy = useEmptyCopy();
  const [photos, setPhotos] = useState<JobPhotoView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('job_photos')
        .select('id, job_id, user_id, storage_path, label, created_at, uploader_display_name, file_size_bytes, mime_type')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
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
    }

    load();
  }, [jobId, refreshKey]);

  if (loading) return <p className="loading-state" role="status">Loading photos…</p>;
  if (error) {
    return (
      <p className="auth-message auth-message-error" role="alert">
        {friendlyErrorMessage(error)}
      </p>
    );
  }
  if (photos.length === 0) {
    return <EmptyState title={emptyCopy.photos.title} description={emptyCopy.photos.description} />;
  }

  return (
    <div className="photo-gallery-readonly">
      {showComparison ? <PhotoComparisonSection photos={photos} /> : null}
      <div className="photo-grid">
        {photos.map((photo) => (
          <figure key={photo.id} className="photo-thumb">
            <img src={photo.url} alt={`${photoTagLabel(photo.label)} photo`} loading="lazy" />
            <figcaption>
              <span className="photo-tag-pill">{photoTagLabel(photo.label)}</span>
              {showMetadata ? (
                <>
                  <span className="photo-meta-line">{formatPhotoWhen(photo.created_at)}</span>
                  {photo.uploader_display_name ? (
                    <span className="photo-meta-line">By {photo.uploader_display_name}</span>
                  ) : null}
                </>
              ) : (
                <span className="photo-meta-line">{photoTagLabel(photo.label)}</span>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
