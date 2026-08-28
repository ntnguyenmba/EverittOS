'use client';

import { Suspense } from 'react';
import { AppShell } from '@/components/app-shell';
import { JobCreator } from '@/components/job-creator';

export default function CreateJobPage() {
  return (
    <AppShell plan="free" role="owner">
      <h1 style={{ margin: '0 0 16px', color: '#132433', fontSize: 32, fontWeight: 800 }}>Create job</h1>
      <p style={{ margin: '0 0 18px', color: '#31495b' }}>
        Choose an existing customer or add a new one, then tap Save Job.
      </p>
      <Suspense fallback={<p className="loading-state">Loading form…</p>}>
        <JobCreator onJobCreated={(jobId) => window.location.assign(`/jobs/${jobId}`)} />
      </Suspense>
    </AppShell>
  );
}
