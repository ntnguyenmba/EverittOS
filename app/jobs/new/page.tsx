'use client';

import { Suspense } from 'react';
import { AppShell } from '@/components/app-shell';
import { JobCreator } from '@/components/job-creator';
import styles from './job-form-simplify.module.css';

export default function NewJobPage() {
  return (
    <AppShell plan="free" role="owner">
      <header className="page-header job-create-page-header">
        <div>
          <h1>Create job</h1>
          <p className="page-subtitle">
            Choose an existing customer or add a new one, then save the job.
          </p>
        </div>
      </header>

      <div className={styles.formWrap}>
        <Suspense fallback={<p className="loading-state">Loading form…</p>}>
          <JobCreator onJobCreated={(jobId) => window.location.assign(`/jobs/${jobId}`)} />
        </Suspense>
      </div>
    </AppShell>
  );
}
