'use client';

import type { JobPhotoView } from '@/lib/job-photos-types';
import { photoTagLabel } from '@/lib/job-photo-tags';

function formatPhotoWhen(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

type BeforeAfterComparisonProps = {
  before: JobPhotoView | null;
  after: JobPhotoView | null;
};

export function BeforeAfterComparison({ before, after }: BeforeAfterComparisonProps) {
  if (!before && !after) return null;

  return (
    <div className="before-after-comparison" aria-label="Before and after comparison">
      <div className="before-after-panel">
        <p className="before-after-label">Before</p>
        {before ? (
          <>
            <img src={before.url} alt="Before photo" />
            <p className="before-after-meta">
              {formatPhotoWhen(before.created_at)}
              {before.uploader_display_name ? ` · ${before.uploader_display_name}` : ''}
            </p>
          </>
        ) : (
          <div className="before-after-empty">No before photo yet</div>
        )}
      </div>
      <div className="before-after-panel">
        <p className="before-after-label">After</p>
        {after ? (
          <>
            <img src={after.url} alt="After photo" />
            <p className="before-after-meta">
              {formatPhotoWhen(after.created_at)}
              {after.uploader_display_name ? ` · ${after.uploader_display_name}` : ''}
            </p>
          </>
        ) : (
          <div className="before-after-empty">No after photo yet</div>
        )}
      </div>
    </div>
  );
}

type PhotoComparisonGridProps = {
  photos: JobPhotoView[];
};

/** Side-by-side pairs when both before and after exist; otherwise single highlights. */
export function PhotoComparisonSection({ photos }: PhotoComparisonGridProps) {
  const beforePhotos = photos.filter((p) => p.label === 'before');
  const afterPhotos = photos.filter((p) => p.label === 'after');

  if (beforePhotos.length === 0 && afterPhotos.length === 0) return null;

  const latestBefore = beforePhotos[0] ?? null;
  const latestAfter = afterPhotos[0] ?? null;

  return (
    <section className="photo-comparison-section">
      <h4>Before &amp; after</h4>
      <BeforeAfterComparison before={latestBefore} after={latestAfter} />
      {beforePhotos.length > 1 || afterPhotos.length > 1 ? (
        <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          Showing most recent before and after. View all photos below for the full gallery.
        </p>
      ) : null}
    </section>
  );
}

export function photoTagBadge(label: string) {
  return photoTagLabel(label);
}
