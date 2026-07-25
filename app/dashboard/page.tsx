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
import { canAccessFinancials } from '@/lib/finance-access';
import { isAdminRole, isClientRole, isContractorRole, isManagerRole, isStaffRole, normalizeRole, type UserRole } from '@/lib/roles';
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

type WorkspaceMetrics = {
  jobs: DashboardJobRow[];
  photoCount: number;
  reportCount: number;
  activityCount: number;
  customerCount: number;
  teamCount: number;
};

type CrmMetrics = {
  openLeads: number;
  closedLeads: number;
  activeCustomers: number;
  recurringCustomers: number;
  inactiveCustomers: number;
};

const emptyWorkspace: WorkspaceMetrics = {
  jobs: [],
  photoCount: 0,
  reportCount: 0,
  activityCount: 0,
  customerCount: 0,
  teamCount: 0
};

const emptyCrm: CrmMetrics = {
  openLeads: 0,
  closedLeads: 0,
  activeCustomers: 0,
  recurringCustomers: 0,
  inactiveCustomers: 0
};

const emptyRevenue = {
  revenueThisMonth: 0,
  cashCollected: 0,
  paidToYou: 0,
  customerInvoices: 0,
  uninvoicedCompletedWork: 0,
  expectedRevenue: 0,
  bookedRevenue: 0,
  pendingIncoming: 0,
  stillOwed: 0,
  overdueAmount: 0,
  latePayments: 0,
  averageDaysToPayment: null,
  outstandingInvoices: 0,
  outstandingInvoiceCount: 0,
  overdueInvoiceCount: 0,
  unpaidInvoiceTotal: 0,
  jobsCompleted: 0,
  jobsCompletedThisMonth: 0,
  completedJobsMissingCompletedAt: 0,
  completedJobsMissingCompletedAtIds: [],
  activeCustomers: 0,
  customerCount: 0,
  upcomingJobs: 0,
  contractorPayThisMonth: 0,
  contractorPaymentsPaid: 0,
  unpaidContractorPay: 0,
  pendingContractorPay: 0,
  otherExpensesThisMonth: 0,
  expenseTotalThisMonth: 0,
  netEstimateThisMonth: 0,
  estimatedProfit: 0,
  netCashFlow: 0,
  cashAfterExpenses: 0,
  cashAfterPaidCosts: 0,
  moneySummaryNetCash: 0,
  hasCreatedInvoices: false,
  loadFailed: false,
  paymentsMissingDates: 0,
  bookingCountThisMonth: 0,
  messageCount: 0,
  reportCount: 0,
  jobsByStatus: {},
  totalJobs: 0
} satisfies DashboardRevenueMetrics;

const OPEN_LEADS = new Set(['open', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'reopened', 'lead']);
const CLOSED_LEADS = new Set(['won', 'closed_lost', 'cancelled', 'lost']);
const QUERY_TIMEOUT_MS = 8000;

async function withTimeout<T>(task: PromiseLike<T>, fallback: T, timeoutMs = QUERY_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(task),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function DashboardAccessNotice() {
  const params = useSearchParams();
  const reason = params.get('reason');
  if (!reason) return null;
  const mapped = mapAccessError(reason);
  return <AccessBlockedBanner title={mapped.title} message={mapped.message} details={params.get('detail') || mapped.details} />;
}

function normalizeJob(job: DashboardJobRow): DashboardJobRow {
  const scheduled = job.scheduled_start?.slice(0, 10) || null;
  return {
    ...job,
    due_date: job.due_date || scheduled,
    start_date: job.start_date || scheduled || job.created_at?.slice(0, 10) || null
  };
}

function CrmCard({ title, value, href }: { title: string; value: number; href: string }) {
  return (
    <Link className="stat" href={href} style={{ minHeight: 120, padding: 20 }}>
      <span className="stat-label">{title}</span>
      <strong className="stat-value" style={{ marginTop: 16 }}>{value}</strong>
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [revenue, setRevenue] = useState<DashboardRevenueMetrics>(emptyRevenue);
  const [workspace, setWorkspace] = useState<WorkspaceMetrics>(emptyWorkspace);
  const [crm, setCrm] = useState<CrmMetrics>(emptyCrm);

  async function loadDashboard() {
    setLoading(true);
    setLoadError(false);

    const auth = await withTimeout(
      supabase.auth.getUser(),
      { data: { user: null }, error: new Error('Authentication timed out') },
      5000
    );
    const user = auth.data.user;

    if (!user) {
      router.replace('/login');
      return;
    }

    setAuthChecked(true);

    const [profileResult, organization] = await Promise.all([
      withTimeout(
        supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle(),
        { data: null, error: new Error('Profile timed out') },
        3500
      ),
      withTimeout(ensureOrganizationForUser(user.id), null, 3500)
    ]);

    const nextPlan = normalizePlan(profileResult.data?.plan);
    const nextRole = normalizeRole(organization?.role || profileResult.data?.role);
    setPlan(nextPlan);
    setRole(nextRole);

    if (isClientRole(nextRole)) {
      router.replace('/portal/client');
      return;
    }
    if (isContractorRole(nextRole)) {
      router.replace('/portal/contractor');
      return;
    }

    const organizationId = organization?.organizationId || null;
    const byOrganization = Boolean(organizationId);

    const jobsQuery = supabase
      .from('jobs')
      .select('id, title, status, due_date, start_date, scheduled_start, created_at, assigned_to, customer_name, phone, address')
      .eq(byOrganization ? 'organization_id' : 'user_id', byOrganization ? organizationId! : user.id)
      .order('scheduled_start', { ascending: true, nullsFirst: false })
      .limit(500);

    const customersQuery = supabase
      .from('customers')
      .select('id, record_type, pipeline_stage')
      .eq(byOrganization ? 'organization_id' : 'user_id', byOrganization ? organizationId! : user.id)
      .limit(10000);

    const activityQuery = supabase
      .from('activity_logs')
      .select('id', { count: 'exact', head: true })
      .eq(byOrganization ? 'organization_id' : 'user_id', byOrganization ? organizationId! : user.id);

    const [nextRevenue, usage, jobsResult, customersResult, activityResult] = await Promise.all([
      canAccessFinancials(nextRole, nextPlan)
        ? withTimeout(fetchDashboardRevenueMetrics(supabase, organizationId), { ...emptyRevenue, loadFailed: true })
        : Promise.resolve(emptyRevenue),
      withTimeout(fetchUsageCounts(user.id, organizationId), {
        jobs: 0,
        photos: 0,
        customers: 0,
        reports: 0,
        workers: 0,
        teamMembers: 0,
        locations: 0
      }),
      withTimeout(jobsQuery, { data: [], error: new Error('Jobs timed out') }),
      withTimeout(customersQuery, { data: [], error: new Error('Customers timed out') }),
      withTimeout(activityQuery, { count: 0, error: new Error('Activity timed out') })
    ]);

    const jobs = ((jobsResult.data || []) as DashboardJobRow[]).map(normalizeJob);
    const rows = (customersResult.data || []) as Array<{ record_type: string | null; pipeline_stage: string | null }>;
    const leads = rows.filter((row) => row.record_type === 'lead');
    const customers = rows.filter((row) => !row.record_type || row.record_type === 'customer');

    setRevenue(nextRevenue);
    setWorkspace({
      jobs,
      photoCount: usage.photos,
      reportCount: usage.reports,
      activityCount: activityResult.count || 0,
      customerCount: customers.length,
      teamCount: usage.teamMembers
    });
    setCrm({
      openLeads: leads.filter((row) => OPEN_LEADS.has(row.pipeline_stage || 'open')).length,
      closedLeads: leads.filter((row) => CLOSED_LEADS.has(row.pipeline_stage || '')).length,
      activeCustomers: customers.filter((row) => !['inactive', 'former'].includes(row.pipeline_stage || '')).length,
      recurringCustomers: customers.filter((row) => row.pipeline_stage === 'recurring').length,
      inactiveCustomers: customers.filter((row) => ['inactive', 'former'].includes(row.pipeline_stage || '')).length
    });

    setLoadError(Boolean(
      profileResult.error || jobsResult.error || customersResult.error || activityResult.error || nextRevenue.loadFailed
    ));
    setLoading(false);
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const staffView = isStaffRole(role);
  const operationsView = isManagerRole(role);

  return (
    <AppShell plan={plan} role={role} showBackButton={false}>
      <Suspense><DashboardAccessNotice /></Suspense>

      <div className="today-page dashboard-home">
        <PageHeader
          title={staffView ? t('dashboard.myWork') : t('dashboard.welcome')}
          subtitle={staffView ? t('dashboard.myWorkSubtitle') : t('dashboard.navSubtitle')}
        />

        {!authChecked ? (
          <section className="card" aria-busy="true" style={{ padding: 24 }}>
            <p className="loading-state" style={{ margin: 0 }}>{t('common.loading')}</p>
          </section>
        ) : (
          <>
            {loadError ? (
              <section className="card" role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <p style={{ margin: 0 }}>Some information could not load. The available dashboard sections are shown.</p>
                <button className="btn btn-sm" type="button" onClick={() => void loadDashboard()} disabled={loading}>
                  {loading ? 'Loading...' : 'Retry'}
                </button>
              </section>
            ) : null}

            {canAccessFinancials(role, plan) ? (
              <DashboardRevenueSnapshot metrics={revenue} loading={loading} />
            ) : null}

            {operationsView ? (
              <section className="card" aria-label={t('dashboard.customersAndLeads')}>
                <div className="dashboard-section-head">
                  <div>
                    <h2>{t('dashboard.customersAndLeads')}</h2>
                    <p className="page-subtitle">{t('dashboard.sidebar.crmSnapshot')}</p>
                  </div>
                  <div className="inline-actions">
                    <Link className="btn btn-sm" href="/leads">{t('nav.leads')}</Link>
                    <Link className="btn btn-sm" href="/customers">{t('nav.customers')}</Link>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16 }}>
                  <CrmCard title={t('dashboard.crm.openLeads')} value={crm.openLeads} href="/leads?status=open" />
                  <CrmCard title={t('dashboard.crm.closedLeads')} value={crm.closedLeads} href="/leads?status=closed" />
                  <CrmCard title={t('dashboard.crm.activeCustomers')} value={crm.activeCustomers} href="/customers?stage=active" />
                  <CrmCard title={t('dashboard.crm.recurringCustomers')} value={crm.recurringCustomers} href="/customers?stage=recurring" />
                  <CrmCard title={t('dashboard.crm.inactiveCustomers')} value={crm.inactiveCustomers} href="/customers?stage=past" />
                </div>
              </section>
            ) : null}

            <TeamCommandCenter enabled={operationsView} />

            {!isAdminRole(role) ? (
              <RoleDashboard
                role={role}
                jobs={workspace.jobs}
                photoCount={workspace.photoCount}
                reportCount={workspace.reportCount}
                activityCount={workspace.activityCount}
                customerCount={workspace.customerCount}
                teamCount={workspace.teamCount}
              />
            ) : null}

            {!staffView ? (
              <section className="dashboard-help-strip" aria-label={t('dashboard.helpAriaLabel')}>
                <div>
                  <h2>{t('supportTraining.dashboardTitle')}</h2>
                  <p>{t('supportTraining.dashboardBody')}</p>
                </div>
                <Link href="/support" className="dashboard-help-link">{t('supportTraining.bookFreeCall')}</Link>
              </section>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
