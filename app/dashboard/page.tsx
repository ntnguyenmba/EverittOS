'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccessBlockedBanner } from '@/components/access-blocked-banner';
import { AppShell } from '@/components/app-shell';
import { DashboardRevenueSnapshot } from '@/components/dashboard-revenue-snapshot';
import { useTranslation } from '@/components/locale-provider';
import { PageHeader } from '@/components/page-header';
import { fetchDashboardRevenueMetrics, type DashboardRevenueMetrics } from '@/lib/dashboard-metrics';
import { mapAccessError } from '@/lib/auth-errors';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isClientRole, normalizeRole, type UserRole } from '@/lib/roles';
import { friendlyErrorMessage } from '@/lib/user-errors';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

function DashboardAccessNotice() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');
  const detail = searchParams.get('detail');
  if (!reason) return null;
  const mapped = mapAccessError(reason);
  return <AccessBlockedBanner title={mapped.title} message={mapped.message} details={detail || mapped.details} />;
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [revenueMetrics, setRevenueMetrics] = useState<DashboardRevenueMetrics>({
    revenueThisMonth: 0,
    outstandingInvoices: 0,
    jobsCompleted: 0,
    activeCustomers: 0
  });
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadDashboard() {
    setLoading(true);
    setErrorMessage('');

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, role')
      .eq('id', user.id)
      .maybeSingle();
    const org = await ensureOrganizationForUser(user.id);
    const userPlan = normalizePlan(profile?.plan);
    const userRole = normalizeRole(org?.role || profile?.role);
    setRole(userRole);
    setPlan(userPlan);

    if (isClientRole(userRole)) {
      router.push('/portal/client');
      return;
    }

    const metrics = await fetchDashboardRevenueMetrics(supabase, org?.organizationId || null);
    setRevenueMetrics(metrics);
    setLoading(false);
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  return (
    <AppShell plan={plan} role={role} showBackButton={false}>
      <Suspense>
        <DashboardAccessNotice />
      </Suspense>

      {errorMessage ? (
        <p className="auth-message auth-message-error" role="alert">
          {friendlyErrorMessage(errorMessage)}
        </p>
      ) : null}

      <div className="today-page dashboard-home">
        <PageHeader
          title={t('dashboard.welcome')}
          subtitle="Use the menu or Ask Everitt to open customers, jobs, photos, schedule, invoices, team, and settings."
        />

        <DashboardRevenueSnapshot metrics={revenueMetrics} loading={loading} />

        <section className="dashboard-help-strip" aria-label="EverittOS support">
          <div>
            <h2>Need assistance?</h2>
            <p>Book an onboarding call for help with customers, jobs, team, scheduling and invoicing.</p>
          </div>
          <Link href="/support" className="dashboard-help-link">
            Book call
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
