'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { JobContractorOptions } from '@/components/job-contractor-options';
import { JobCreator } from '@/components/job-creator';
import { PageHeader } from '@/components/page-header';
import { useTranslation } from '@/components/locale-provider';
import { JobPrefillBridge } from './job-prefill-bridge';
import styles from './job-form-simplify.module.css';

export default function NewJobPage() {
  const router = useRouter();
  const { t } = useTranslation();

  function finishJobCreation(jobId: string) {
    router.push(`/jobs/${jobId}`);
    const params = new URLSearchParams(window.location.search);
    if (params.get('source') !== 'quotes') return;

    void (async () => {
      try {
        const encoded = params.get('quote_context');
        const parsed = encoded ? JSON.parse(encoded) : {};
        await fetch(`/api/jobs/${jobId}/quote-context`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceType: parsed.serviceType || params.get('service') || params.get('title') || null,
            sizeValue: parsed.sizeValue ?? null,
            sizeUnit: parsed.sizeUnit || null,
            primaryUnits: parsed.primaryUnits ?? null,
            extraUnits: parsed.extraUnits ?? null,
            condition: parsed.condition || null,
            frequency: parsed.frequency || null,
            addOns: Array.isArray(parsed.addOns) ? parsed.addOns : [],
            laborHours: parsed.laborHours ?? null,
            price: parsed.price ?? params.get('price') ?? params.get('client_income') ?? null,
            currency: parsed.currency || null,
            sourceRequest: parsed.sourceRequest || null
          })
        });
        const quoteId = params.get('quote_id');
        if (quoteId) {
          await fetch(`/api/quotes/${quoteId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'converted', jobId })
          });
        }
      } catch {}
    })();
  }

  return (
    <AppShell plan="free" role="owner">
      <PageHeader title={t('dashboard.newJob')} />
      <div className={styles.formWrap}>
        <Suspense fallback={<p className="loading-state">{t('common.loading')}</p>}>
          <JobPrefillBridge />
          <JobCreator onJobCreated={finishJobCreation} />
          <JobContractorOptions />
        </Suspense>
      </div>
    </AppShell>
  );
}
