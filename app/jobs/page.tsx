'use client';

import { Suspense } from 'react';
import { JobsList } from '@/components/jobs-list';
import { useTranslation } from '@/components/locale-provider';

const loadingCopy = {
  en: 'Loading jobs…',
  es: 'Cargando trabajos…',
  vi: 'Đang tải công việc…'
} as const;

export default function JobsPage() {
  const { locale } = useTranslation();
  return (
    <Suspense fallback={<div className="card">{loadingCopy[locale]}</div>}>
      <JobsList />
    </Suspense>
  );
}
