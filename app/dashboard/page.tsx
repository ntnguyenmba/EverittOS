'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccessBlockedBanner } from '@/components/access-blocked-banner';
import { AppShell } from '@/components/app-shell';
import { DashboardRevenueSnapshot } from '@/components/dashboard-revenue-snapshot';
import { TeamCommandCenter } from '@/components/dashboard/team-command-center';
import { useTranslation } from '@/components/locale-provider';
import { PageHeader } from '@/components/page-header';
import { RoleDashboard } from '@/components/role-dashboard';
import { fetchDashboardRevenueMetrics, type DashboardRevenueMetrics } from '@/lib/dashboard-metrics';
import { mapAccessError } from '@/lib/auth-errors';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchUsageCounts } from '@/lib/everittos-usage';
import { isAdminRole, isClientRole, normalizeRole, type UserRole } from '@/lib/roles';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

type DashboardJobRow = {
  id: string;
  title: string;
  status: string | null;
  due_date: string | null;
  start_date: string | null;
  scheduled_start?: string | null;
  created_at?: string | null;
};

type ManagerWorkspaceMetrics = {
  jobs: DashboardJobRow[];
  photoCount: number;
  reportCount: number;
  activityCount: number;
  customerCount: number;
  teamCount: number;
};

const emptyManagerWorkspaceMetrics: ManagerWorkspaceMetrics = {
  jobs: [],
  photoCount: 0,
  reportCount: 0,
  activityCount: 0,
  customerCount: 0,
  teamCount: 0
};

function DashboardAccessNotice() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');
  const detail = searchParams.get('detail');
  if (!reason) return null;
  const mapped = mapAccessError(reason);
  return <AccessBlockedBanner title={mapped.title} message={mapped.message} details={detail || mapped.details} />;
}

function normalizeDashboardJob(job: DashboardJobRow): DashboardJobRow {
  const scheduledDate = job.scheduled_start ? job.scheduled_start.slice(0, 10) : null;
  const createdDate = job.created_at ? job.created_at.slice(0, 10) : null;

  return {
    id: job.id,
    title: job.title,
    status: job.status,
    due_date: job.due_date || scheduledDate,
    start_date: job.start_date || scheduledDate || createdDate
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [revenueMetrics, setRevenueMetrics] = useState<DashboardRevenueMetrics>({
    revenueThisMonth: 0,
    outstandingInvoices: 0,
    overdueInvoiceCount: 0,
    unpaidInvoiceTotal: 0,
    jobsCompleted: 0,
    jobsCompletedThisMonth: 0,
    activeCustomers: 0,
    customerCount: 0,
    upcomingJobs: 0,
    expenseTotalThisMonth: 0,
    netEstimateThisMonth: 0,
    bookingCountThisMonth: 0,
    messageCount: 0,
    reportCount: 0,
    jobsByStatus: {},
    totalJobs: 0
  });
  const [managerWorkspaceMetrics, setManagerWorkspaceMetrics] = useState<ManagerWorkspaceMetrics>(emptyManagerWorkspaceMetrics);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    setLoading(true);

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

    const organizationId = org?.organizationId || null;
    const [metrics, usageCounts, jobsRes, activityRes] = await Promise.all([
      fetchDashboardRevenueMetrics(supabase, organizationId),
      fetchUsageCounts(user.id, organizationId),
      organizationId
        ? supabase
            .from('jobs')
            .select('id, title, status, due_date, start_date, scheduled_start, created_at')
            .eq('organization_id', organizationId)
            .order('scheduled_start', { ascending: true, nullsFirst: false })
            .limit(500)
        : supabase
            .from('jobs')
            .select('id, title, status, due_date, start_date, scheduled_start, created_at')
            .eq('user_id', user.id)
            .order('scheduled_start', { ascending: true, nullsFirst: false })
            .limit(500),
      organizationId
        ? supabase
            .from('activity_logs')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
        : supabase
            .from('activity_logs')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
    ]);

    setRevenueMetrics(metrics);
    setManagerWorkspaceMetrics({
      jobs: ((jobsRes.data || []) as DashboardJobRow[]).map(normalizeDashboardJob),
      photoCount: usageCounts.photos,
      reportCount: usageCounts.reports,
      activityCount: activityRes.error ? 0 : activityRes.count || 0,
      customerCount: usageCounts.customers,
      teamCount: usageCounts.teamMembers
    });
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

      <div className="today-page dashboard-home">
        <PageHeader
          title={t('dashboard.welcome')}
          subtitle={t('dashboard.navSubtitle')}
        />

        <DashboardRevenueSnapshot metrics={revenueMetrics} loading={loading} />

        <TeamCommandCenter enabled={isAdminRole(role)} />

        {!loading && !isAdminRole(role) ? (
          <RoleDashboard
            role={role}
            jobs={managerWorkspaceMetrics.jobs}
            photoCount={managerWorkspaceMetrics.photoCount}
            reportCount={managerWorkspaceMetrics.reportCount}
            activityCount={managerWorkspaceMetrics.activityCount}
            customerCount={managerWorkspaceMetrics.customerCount}
            teamCount={managerWorkspaceMetrics.teamCount}
          />
        ) : null}

        <section className="dashboard-help-strip" aria-label={t('dashboard.helpAriaLabel')}>
          <div>
            <h2>{t('supportTraining.dashboardTitle')}</h2>
            <p>{t('supportTraining.dashboardBody')}</p>
          </div>
          <Link href="/support" className="dashboard-help-link">
            {t('supportTraining.bookFreeCall')}
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
