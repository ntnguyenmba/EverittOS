'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

type PhotoLabel = 'before' | 'during' | 'after' | 'other';

type PhotoUploadProps = {
  jobId: string;
  userId: string;
  disabled?: boolean;
  onUploaded?: () => void;
};

const LABELS: PhotoLabel[] = ['before', 'during', 'after', 'other'];

export function PhotoUpload({ jobId, userId, disabled, onUploaded }: PhotoUploadProps) {
  const [label, setLabel] = useState<PhotoLabel>('before');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleFiles(files: FileList | null) {
    if (!files?.length || disabled) return;
    setUploading(true);
    setMessage('');

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${userId}/${jobId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage.from('job-photos').upload(path, file, {
        cacheControl: '3600',
        upsert: false
      });

      if (uploadError) {
        setMessage(uploadError.message);
        continue;
      }

      const { error: rowError } = await supabase.from('job_photos').insert({
        user_id: userId,
        job_id: jobId,
        storage_path: path,
        label
      });

      if (rowError) setMessage(rowError.message);
    }

    setUploading(false);
    onUploaded?.();
  }

  return (
    <div className="upload-box">
      <div className="form" style={{ marginBottom: 12 }}>
        <label htmlFor="photo-label">Photo label</label>
        <select
          id="photo-label"
          className="input"
          value={label}
          onChange={(e) => setLabel(e.target.value as PhotoLabel)}
          disabled={disabled || uploading}
        >
          {LABELS.map((entry) => (
            <option key={entry} value={entry}>
              {entry.charAt(0).toUpperCase() + entry.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        disabled={disabled || uploading}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p>{uploading ? 'Uploading...' : 'Add photos from your phone or computer.'}</p>
      {message && <p>{message}</p>}
      {disabled && <p>Photo uploads require an active Pro or Business plan.</p>}
    </div>
  );
}
