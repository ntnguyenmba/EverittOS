'use client';

import { Suspense } from 'react';
import { AppShell } from '@/components/app-shell';
import { JobCreateI18nBind } from '@/components/job-create-i18n-bind';
import { JobCreator } from '@/components/job-creator';
import { useTranslation } from '@/components/locale-provider';
import { getJobCreateCopy } from '@/lib/i18n/job-create-copy';
import styles from './job-form-simplify.module.css';

export default function NewJobPage() {
  const { locale } = useTranslation();
  const copy = getJobCreateCopy(locale);

  return (
    <AppShell plan="free" role="owner">
      <JobCreateI18nBind />
      <header className="page-header job-create-page-header">
        <div>
          <h1>{copy.pageTitle}</h1>
          <p className="page-subtitle">{copy.intro}</p>
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
