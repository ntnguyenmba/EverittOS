'use client';

import { Suspense } from 'react';
import { JobsList } from '@/components/jobs-list';
import { PageLoading } from '@/components/page-loading';

export default function JobsPage() {
  return (
    <Suspense fallback={<PageLoading className="card" />}>
      <JobsList />
    </Suspense>
  );
}
