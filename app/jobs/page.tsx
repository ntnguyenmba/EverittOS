'use client';

import { Suspense } from 'react';
import { JobsList } from '@/components/jobs-list';

export default function JobsPage() {
  return (
    <Suspense>
      <JobsList />
    </Suspense>
  );
}
