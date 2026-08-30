'use client';

import { Suspense } from 'react';
import { JobsList } from '@/components/jobs-list';

export default function JobsPage() {
  return (
    <Suspense fallback={<div className="card">Loading jobs…</div>}>
      <JobsList />
    </Suspense>
  );
}
