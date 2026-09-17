'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { AppShell } from '@/components/app-shell';
import { JobCreateI18nBind } from '@/components/job-create-i18n-bind';
import { JobCreateRecurringDurationBridge } from '@/components/job-create-recurring-duration-bridge';
import { useTranslation } from '@/components/locale-provider';
import { getJobCreateCopy } from '@/lib/i18n/job-create-copy';
import styles from './job-form-simplify.module.css';

function JobCreatorLoading() {
  const { locale } = useTranslation();
  return <p className="loading-state">{getJobCreateCopy(locale).loadingForm}</p>;
}

const JobCreator = dynamic(
  () => import('@/components/job-creator').then((mod) => mod.JobCreator),
  {
    ssr: false,
    loading: () => <JobCreatorLoading />
  }
);

export default function NewJobPage() {
  const { locale } = useTranslation();
  const copy = getJobCreateCopy(locale);

  return (
    <AppShell plan="free" role="owner">
      <JobCreateI18nBind />
      <JobCreateRecurringDurationBridge />
      <header className="page-header job-create-page-header">
        <div>
          <h1>{copy.pageTitle}</h1>
          <p className="page-subtitle">{copy.intro}</p>
        </div>
      </header>

      <div className={styles.formWrap}>
        <Suspense fallback={<p className="loading-state">{copy.loadingForm}</p>}>
          <JobCreator onJobCreated={(jobId) => window.location.assign(`/jobs/${jobId}`)} />
        </Suspense>
      </div>
    </AppShell>
  );
}
