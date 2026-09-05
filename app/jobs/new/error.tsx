'use client';

import Link from 'next/link';

export default function NewJobError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="card" style={{ maxWidth: 520, margin: '32px auto' }}>
      <h2>Create Job could not load</h2>
      <p className="muted">{error.message || 'The form hit an unexpected error.'}</p>
      <div className="button-row" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-primary" onClick={() => reset()}>
          Try again
        </button>
        <Link className="btn" href="/jobs">
          Back to jobs
        </Link>
      </div>
    </div>
  );
}
