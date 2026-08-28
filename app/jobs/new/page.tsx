'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { JobContractorOptions } from '@/components/job-contractor-options';
import { JobCreator } from '@/components/job-creator';
import { PageHeader } from '@/components/page-header';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isClientRole, isContractorRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { useTranslation } from '@/components/locale-provider';
import { JobPrefillBridge } from './job-prefill-bridge';
import styles from './job-form-simplify.module.css';

type MembershipResponse = {
  activeRole?: string | null;
  destination?: string | null;
};

export default function NewJobPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('employee');
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login?next=/jobs/new');
        return;
      }

      const [{ data: profile }, membershipsResponse] = await Promise.all([
        supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle(),
        fetch('/api/org/memberships', { cache: 'no-store' })
      ]);

      setPlan(normalizePlan(profile?.plan));

      if (!membershipsResponse.ok) {
        router.replace('/dashboard');
        return;
      }

      const memberships = (await membershipsResponse.json()) as MembershipResponse;
      const activeRole = normalizeRole(memberships.activeRole || 'employee');
      setRole(activeRole);

      if (isContractorRole(activeRole) || isClientRole(activeRole)) {
        router.replace(memberships.destination || '/dashboard');
        return;
      }

      setAuthorized(true);
    }

    void load();
  }, [router]);

  async function finishJobCreation(jobId: string) {
    const params = new URLSearchParams(window.location.search);
    if (params.get('source') === 'quotes') {
      const context = params.get('quote_context');
      if (context) {
        try {
          const parsed = JSON.parse(context);
          await fetch(`/api/jobs/${jobId}/quote-context`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed)
          });
        } catch {
          // The job is already saved. Never block the operator if optional quote history cannot be attached.
        }
      }
    }
    router.push(`/jobs/${jobId}`);
  }

  if (!authorized) {
    return <p className="loading-state">{t('common.loading')}</p>;
  }

  return (
    <AppShell plan={plan} role={role}>
      <PageHeader title={t('dashboard.newJob')} />
      <div className={styles.formWrap}>
        <Suspense fallback={<p className="loading-state">{t('common.loading')}</p>}>
          <JobPrefillBridge />
          <JobCreator onJobCreated={(jobId) => void finishJobCreation(jobId)} />
          <JobContractorOptions />
        </Suspense>
      </div>
    </AppShell>
  );
}
