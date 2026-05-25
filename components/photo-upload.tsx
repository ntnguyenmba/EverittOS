'use client';
import { useState } from 'react';

export function PhotoUpload({ label }: { label: string }) {
  const [file, setFile] = useState('');
  return (
    <label className="upload-box">
      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0]?.name || '')} />
      <strong>{label}</strong>
      <p>{file || 'Tap to upload photo proof'}</p>
    </label>
  );
}
