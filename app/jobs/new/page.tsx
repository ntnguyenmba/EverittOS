'use client';

import { Suspense } from 'react';
import { AppShell } from '@/components/app-shell';
import { JobCreator } from '@/components/job-creator';
import { JobPrefillBridge } from './job-prefill-bridge';

export default function NewJobPage() {
  return (
    <AppShell plan="free" role="owner">
      <h1 style={{ margin: '0 0 16px', color: '#132433', fontSize: 32, fontWeight: 800 }}>Create job</h1>
      <p style={{ margin: '0 0 18px', color: '#31495b' }}>Add a customer, then save. Date and times can be filled later if you have them.</p>
      <Suspense fallback={<p className="loading-state">Loading form…</p>}>
        <JobPrefillBridge />
        <JobCreator onJobCreated={(jobId) => window.location.assign(`/jobs/${jobId}`)} />
      </Suspense>
    </AppShell>
  );
}
