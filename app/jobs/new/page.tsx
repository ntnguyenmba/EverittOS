'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { JobAddressAutocomplete } from '@/components/job-address-autocomplete';
import { JobCreator } from '@/components/job-creator';
import { PageHeader } from '@/components/page-header';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

export default function NewJobPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/jobs/new');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));
      setRole(normalizeRole(profile?.role));
    }
    void load();
  }, [router]);

  return (
    <AppShell plan={plan} role={role}>
      <PageHeader
        title="New job"
        subtitle="Create a job, assign the right people, then add photos and proof as the work happens."
        action={
          <Link className="btn" href="/jobs">
            Back to jobs
          </Link>
        }
      />
      <JobAddressAutocomplete />
      <Suspense fallback={<p className="loading-state">Loading job form...</p>}>
        <JobCreator onJobCreated={(jobId) => router.push(`/jobs/${jobId}`)} />
      </Suspense>
    </AppShell>
  );
}
