'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type PhotoRow = {
  id: string;
  storage_path: string;
  label: string;
  created_at: string | null;
};

type PhotoGalleryProps = {
  jobId: string;
  refreshKey?: number;
};

export function PhotoGallery({ jobId, refreshKey = 0 }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<{ id: string; label: string; url: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('job_photos')
        .select('id, storage_path, label, created_at')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      const rows = (data || []) as PhotoRow[];
      const withUrls = await Promise.all(
        rows.map(async (row) => {
          const { data: signed } = await supabase.storage.from('job-photos').createSignedUrl(row.storage_path, 3600);
          return {
            id: row.id,
            label: row.label,
            url: signed?.signedUrl || ''
          };
        })
      );

      setPhotos(withUrls.filter((p) => p.url));
      setLoading(false);
    }

    load();
  }, [jobId, refreshKey]);

  if (loading) return <p>Loading photos...</p>;
  if (error) return <p>{error}</p>;
  if (photos.length === 0) return <p>No photos yet. Upload before and after proof below.</p>;

  return (
    <div className="photo-grid">
      {photos.map((photo) => (
        <figure key={photo.id} className="photo-thumb">
          <img src={photo.url} alt={`${photo.label} photo`} />
          <figcaption>{photo.label}</figcaption>
        </figure>
      ))}
    </div>
  );
}
