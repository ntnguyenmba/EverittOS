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
import { isAdminRole, isClientRole, isManagerRole, isStaffRole, normalizeRole, type UserRole } from '@/lib/roles';
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
  assigned_to?: string | null;
  customer_name?: string | null;
  phone?: string | null;
  address?: string | null;
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
    start_date: job.start_date || scheduledDate || createdDate,
    assigned_to: job.assigned_to,
    customer_name: job.customer_name,
    phone: job.phone,
    address: job.address
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
  const [teamLeadCount, setTeamLeadCount] = useState(0);
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

    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
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
    const staffView = isStaffRole(userRole);
    const [metrics, usageCounts, jobsRes, activityRes, workersRes, leadsRes] = await Promise.all([
      fetchDashboardRevenueMetrics(supabase, organizationId),
      fetchUsageCounts(user.id, organizationId),
      organizationId
        ? supabase
            .from('jobs')
            .select('id, title, status, due_date, start_date, scheduled_start, created_at, assigned_to, customer_name, phone, address')
            .eq('organization_id', organizationId)
            .order('scheduled_start', { ascending: true, nullsFirst: false })
            .limit(500)
        : supabase
            .from('jobs')
            .select('id, title, status, due_date, start_date, scheduled_start, created_at, assigned_to, customer_name, phone, address')
            .eq('user_id', user.id)
            .order('scheduled_start', { ascending: true, nullsFirst: false })
            .limit(500),
      organizationId
        ? supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId)
        : supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      organizationId
        ? supabase.from('workers').select('id, auth_user_id').eq('organization_id', organizationId)
        : Promise.resolve({ data: [] }),
      organizationId
        ? supabase
            .from('customers')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .or('record_type.eq.lead,pipeline_stage.in.(lead,qualified)')
        : supabase
            .from('customers')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .or('record_type.eq.lead,pipeline_stage.in.(lead,qualified)')
    ]);

    const assignedWorkerIds = new Set(
      ((workersRes.data || []) as { id: string; auth_user_id?: string | null }[])
        .filter((worker) => worker.auth_user_id === user.id)
        .map((worker) => worker.id)
    );

    const normalizedJobs = ((jobsRes.data || []) as DashboardJobRow[]).map(normalizeDashboardJob);
    const visibleJobs = staffView ? normalizedJobs.filter((job) => job.assigned_to && assignedWorkerIds.has(job.assigned_to)) : normalizedJobs;

    setRevenueMetrics(metrics);
    setTeamLeadCount(staffView || leadsRes.error ? 0 : leadsRes.count || 0);
    setManagerWorkspaceMetrics({
      jobs: visibleJobs,
      photoCount: usageCounts.photos,
      reportCount: staffView ? 0 : usageCounts.reports,
      activityCount: staffView ? 0 : activityRes.error ? 0 : activityRes.count || 0,
      customerCount: staffView ? 0 : usageCounts.customers,
      teamCount: staffView ? 0 : usageCounts.teamMembers
    });
    setLoading(false);
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const staffView = isStaffRole(role);
  const operationsView = isManagerRole(role);
  const salesCardStyle = {
    display: 'flex',
    minHeight: 172,
    height: '100%',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    border: '1px solid var(--line)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--surface)',
    padding: 22,
    boxShadow: 'var(--shadow-subtle)'
  };

  return (
    <AppShell plan={plan} role={role} showBackButton={false}>
      <Suspense>
        <DashboardAccessNotice />
      </Suspense>

      <div className="today-page dashboard-home">
        <PageHeader title={staffView ? 'My work' : t('dashboard.welcome')} subtitle={staffView ? 'Today, assigned jobs, customer contact, and field actions.' : t('dashboard.navSubtitle')} />

        {!staffView ? <DashboardRevenueSnapshot metrics={revenueMetrics} loading={loading} /> : null}

        {operationsView ? (
          <section className="card" aria-label={t('dashboard.customersAndLeads')}>
            <div className="dashboard-section-head" style={{ alignItems: 'flex-start', gap: 18, marginBottom: 22 }}>
              <div>
                <h2>{t('dashboard.customersAndLeads')}</h2>
                <p className="page-subtitle" style={{ marginTop: 8, marginBottom: 0 }}>
                  {t('dashboard.sidebar.crmSnapshot')}
                </p>
              </div>
              <Link className="btn btn-sm" href="/leads">
                {t('nav.leads')}
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'stretch' }}>
              <Link href="/leads" style={salesCardStyle}>
                <span className="stat-label">{t('nav.leads')}</span>
                <strong className="stat-value" style={{ marginTop: 18 }}>{teamLeadCount}</strong>
                <p className="muted" style={{ margin: '18px 0 0', lineHeight: 1.45 }}>
                  {t('empty.leads.description')}
                </p>
              </Link>
              <Link href="/customers" style={salesCardStyle}>
                <span className="stat-label">{t('dashboard.customersAndLeads')}</span>
                <strong className="stat-value" style={{ marginTop: 18 }}>{managerWorkspaceMetrics.customerCount}</strong>
                <p className="muted" style={{ margin: '18px 0 0', lineHeight: 1.45 }}>
                  {t('ux.pageTitles.customers')}
                </p>
              </Link>
            </div>
          </section>
        ) : null}

        <TeamCommandCenter enabled={operationsView} />

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

        {!staffView ? (
          <section className="dashboard-help-strip" aria-label={t('dashboard.helpAriaLabel')}>
            <div>
              <h2>{t('supportTraining.dashboardTitle')}</h2>
              <p>{t('supportTraining.dashboardBody')}</p>
            </div>
            <Link href="/support" className="dashboard-help-link">
              {t('supportTraining.bookFreeCall')}
            </Link>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
