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
import { isActiveCustomerRecord } from '@/lib/job-operational-date';
import { mapAccessError } from '@/lib/auth-errors';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchUsageCounts, type UsageCounts } from '@/lib/everittos-usage';
import { canAccessFinancials } from '@/lib/finance-access';
import { isAdminRole, isClientRole, isContractorRole, isManagerRole, isStaffRole, normalizeRole, type UserRole } from '@/lib/roles';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';
import { buildAssignmentWorkerIdsByJob, isJobAssignedToWorker } from '@/lib/worker-assignment';

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

type CrmDashboardMetrics = {
  totalLeads: number;
  openLeads: number;
  closedLeads: number;
  activeCustomers: number;
  recurringCustomers: number;
  inactiveCustomers: number;
};

const emptyManagerWorkspaceMetrics: ManagerWorkspaceMetrics = {
  jobs: [],
  photoCount: 0,
  reportCount: 0,
  activityCount: 0,
  customerCount: 0,
  teamCount: 0
};

const emptyCrmDashboardMetrics: CrmDashboardMetrics = {
  totalLeads: 0,
  openLeads: 0,
  closedLeads: 0,
  activeCustomers: 0,
  recurringCustomers: 0,
  inactiveCustomers: 0
};

const emptyUsageCounts: UsageCounts = {
  jobs: 0,
  photos: 0,
  customers: 0,
  reports: 0,
  workers: 0,
  teamMembers: 0,
  locations: 0
};

const emptyDashboardRevenueMetrics: DashboardRevenueMetrics = {
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
};

const OPEN_LEAD_STAGES = new Set(['open', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'reopened', 'lead']);
const CLOSED_LEAD_STAGES = new Set(['won', 'closed_lost', 'cancelled', 'lost']);

async function safeLoad<T>(label: string, task: PromiseLike<T>, fallback: T): Promise<T> {
  try {
    return await task;
  } catch (error) {
    console.error(`[dashboard] ${label} failed`, error);
    return fallback;
  }
}

function logQueryError(label: string, result: { error?: unknown } | null | undefined): void {
  if (result?.error) console.error(`[dashboard] ${label} query failed`, result.error);
}

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

function crmCard(title: string, value: number, href: string, body: string, style: React.CSSProperties) {
  return (
    <Link href={href} style={style}>
      <span className="stat-label">{title}</span>
      <strong className="stat-value" style={{ marginTop: 18 }}>{value}</strong>
      <p className="muted" style={{ margin: '18px 0 0', lineHeight: 1.45 }}>{body}</p>
    </Link>
  );
}

function DashboardLoadingShell() {
  return (
    <div aria-label="Loading dashboard" aria-busy="true" style={{ display: 'grid', gap: 24 }}>
      <section className="card" style={{ minHeight: 286 }}>
        <div className="skeleton" style={{ width: 180, height: 20, borderRadius: 8 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 24 }}>
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="skeleton" style={{ minHeight: 150, borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      </section>
      <section className="card" style={{ minHeight: 330 }}>
        <div className="skeleton" style={{ width: 220, height: 20, borderRadius: 8 }} />
        <div className="skeleton" style={{ width: '100%', height: 240, borderRadius: 'var(--radius-lg)', marginTop: 24 }} />
      </section>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [revenueMetrics, setRevenueMetrics] = useState<DashboardRevenueMetrics>(emptyDashboardRevenueMetrics);
  const [managerWorkspaceMetrics, setManagerWorkspaceMetrics] = useState<ManagerWorkspaceMetrics>(emptyManagerWorkspaceMetrics);
  const [crmMetrics, setCrmMetrics] = useState<CrmDashboardMetrics>(emptyCrmDashboardMetrics);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [accessResolved, setAccessResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  async function loadDashboard() {
    setLoading(true);
    setLoadError(false);

    try {
      const authResult = await supabase.auth.getUser();
      if (authResult.error) console.error('[dashboard] authentication failed', authResult.error);
      const user = authResult.data.user;

      if (!user) {
        router.push('/login');
        return;
      }

      const [profileRes, org] = await Promise.all([
        safeLoad(
          'profile',
          supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle(),
          { data: null, error: null }
        ),
        safeLoad('organization', ensureOrganizationForUser(user.id), null)
      ]);

      logQueryError('profile', profileRes);

      const profile = profileRes.data;
      const userPlan = normalizePlan(profile?.plan);
      const userRole = normalizeRole(org?.role || profile?.role);
      setRole(userRole);
      setPlan(userPlan);

      if (isClientRole(userRole)) {
        router.push('/portal/client');
        return;
      }

      if (isContractorRole(userRole)) {
        router.push('/portal/contractor');
        return;
      }

      setAccessResolved(true);

      const organizationId = org?.organizationId || null;
      const staffView = isStaffRole(userRole);
      const canViewFinancials = canAccessFinancials(userRole, userPlan);
      const customerScope = organizationId
        ? supabase.from('customers').select('id, record_type, pipeline_stage').eq('organization_id', organizationId).limit(10000)
        : supabase.from('customers').select('id, record_type, pipeline_stage').eq('user_id', user.id).limit(10000);
      const jobsQuery = organizationId
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
            .limit(500);
      const activityQuery = organizationId
        ? supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId)
        : supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
      const workersQuery = organizationId
        ? supabase.from('workers').select('id, auth_user_id').eq('organization_id', organizationId)
        : Promise.resolve({ data: [], error: null });

      const [metrics, usageCounts, jobsRes, activityRes, workersRes, customersRes] = await Promise.all([
        safeLoad(
          'revenue metrics',
          canViewFinancials ? fetchDashboardRevenueMetrics(supabase, organizationId) : Promise.resolve(emptyDashboardRevenueMetrics),
          { ...emptyDashboardRevenueMetrics, loadFailed: canViewFinancials }
        ),
        safeLoad('usage counts', fetchUsageCounts(user.id, organizationId), emptyUsageCounts),
        safeLoad('jobs', jobsQuery, { data: [], error: null }),
        safeLoad('activity', activityQuery, { count: 0, error: null }),
        safeLoad('workers', workersQuery, { data: [], error: null }),
        safeLoad('customers', customerScope, { data: [], error: null })
      ]);

      logQueryError('jobs', jobsRes);
      logQueryError('activity', activityRes);
      logQueryError('workers', workersRes);
      logQueryError('customers', customersRes);

      const assignedWorkerIds = (
        ((workersRes.data || []) as { id: string; auth_user_id?: string | null }[])
          .filter((worker) => worker.auth_user_id === user.id)
          .map((worker) => worker.id)
      );
      const staffIdentity = { userId: user.id, workerIds: assignedWorkerIds };

      const assignmentResult = staffView && assignedWorkerIds.length > 0
        ? await safeLoad(
            'job assignments',
            supabase.from('job_assignments').select('job_id, worker_id').in('worker_id', assignedWorkerIds),
            { data: [], error: null }
          )
        : { data: [] as Array<{ job_id?: string | null; worker_id?: string | null }>, error: null };
      logQueryError('job assignments', assignmentResult);
      const assignmentWorkerIdsByJob = buildAssignmentWorkerIdsByJob(assignmentResult.data || []);

      const normalizedJobs = ((jobsRes.data || []) as DashboardJobRow[]).map(normalizeDashboardJob);
      const visibleJobs = staffView
        ? normalizedJobs.filter((job) => isJobAssignedToWorker(job, staffIdentity, assignmentWorkerIdsByJob))
        : normalizedJobs;
      const rows = ((customersRes.data || []) as { id: string; record_type: string | null; pipeline_stage: string | null }[]);
      const leadRows = rows.filter((row) => row.record_type === 'lead');
      const customerRows = rows.filter((row) => !row.record_type || row.record_type === 'customer');
      const openLeadCount = leadRows.filter((row) => OPEN_LEAD_STAGES.has(row.pipeline_stage || 'open')).length;
      const closedLeadCount = leadRows.filter((row) => CLOSED_LEAD_STAGES.has(row.pipeline_stage || '')).length;
      const activeCustomerCount = customerRows.filter((row) => isActiveCustomerRecord(row)).length;
      const recurringCustomerCount = customerRows.filter((row) => row.pipeline_stage === 'recurring').length;
      const inactiveCustomerCount = customerRows.filter((row) => row.pipeline_stage === 'inactive' || row.pipeline_stage === 'former').length;

      setRevenueMetrics(metrics);
      setCrmMetrics(
        staffView || customersRes.error
          ? emptyCrmDashboardMetrics
          : {
              totalLeads: leadRows.length,
              openLeads: openLeadCount,
              closedLeads: closedLeadCount,
              activeCustomers: activeCustomerCount,
              recurringCustomers: recurringCustomerCount,
              inactiveCustomers: inactiveCustomerCount
            }
      );
      setManagerWorkspaceMetrics({
        jobs: visibleJobs,
        photoCount: usageCounts.photos,
        reportCount: staffView ? 0 : usageCounts.reports,
        activityCount: staffView ? 0 : activityRes.error ? 0 : activityRes.count || 0,
        customerCount: staffView ? 0 : customerRows.length,
        teamCount: staffView ? 0 : usageCounts.teamMembers
      });

      const partialFailure = Boolean(
        metrics.loadFailed || jobsRes.error || activityRes.error || workersRes.error || customersRes.error || assignmentResult.error
      );
      setLoadError(partialFailure);
    } catch (error) {
      console.error('[dashboard] unexpected load failure', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
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

      <div className="today-page dashboard-home" style={{ minHeight: '100vh' }}>
        <PageHeader title={accessResolved && staffView ? t('dashboard.myWork') : t('dashboard.welcome')} subtitle={accessResolved && staffView ? t('dashboard.myWorkSubtitle') : t('dashboard.navSubtitle')} />

        {!accessResolved ? <DashboardLoadingShell /> : (
          <>
            {loadError ? (
              <section className="card" role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <p style={{ margin: 0 }}>Some dashboard information could not load. The available sections are shown below.</p>
                <button className="btn btn-sm" type="button" onClick={() => void loadDashboard()} disabled={loading}>
                  {loading ? 'Loading...' : 'Retry'}
                </button>
              </section>
            ) : null}

            {canAccessFinancials(role, plan) ? <DashboardRevenueSnapshot metrics={revenueMetrics} loading={loading} /> : null}

            {operationsView ? (
              <section className="card" aria-label={t('dashboard.customersAndLeads')}>
                <div className="dashboard-section-head" style={{ alignItems: 'flex-start', gap: 18, marginBottom: 22 }}>
                  <div>
                    <h2>{t('dashboard.customersAndLeads')}</h2>
                    <p className="page-subtitle" style={{ marginTop: 8, marginBottom: 0 }}>
                      {t('dashboard.sidebar.crmSnapshot')}
                    </p>
                  </div>
                  <div className="inline-actions">
                    <Link className="btn btn-sm" href="/leads">{t('nav.leads')}</Link>
                    <Link className="btn btn-sm" href="/customers">{t('nav.customers')}</Link>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, alignItems: 'stretch' }}>
                  {crmCard(t('dashboard.crm.openLeads'), crmMetrics.openLeads, '/leads?status=open', t('dashboard.crm.openLeadsHelp'), salesCardStyle)}
                  {crmCard(t('dashboard.crm.closedLeads'), crmMetrics.closedLeads, '/leads?status=closed', t('dashboard.crm.closedLeadsHelp'), salesCardStyle)}
                  {crmCard(t('dashboard.crm.activeCustomers'), crmMetrics.activeCustomers, '/customers?stage=active', t('dashboard.crm.activeCustomersHelp'), salesCardStyle)}
                  {crmCard(t('dashboard.crm.recurringCustomers'), crmMetrics.recurringCustomers, '/customers?stage=recurring', t('dashboard.crm.recurringCustomersHelp'), salesCardStyle)}
                  {crmCard(t('dashboard.crm.inactiveCustomers'), crmMetrics.inactiveCustomers, '/customers?stage=past', t('dashboard.crm.inactiveCustomersHelp'), salesCardStyle)}
                </div>
              </section>
            ) : null}

            <TeamCommandCenter enabled={operationsView} />

            {!isAdminRole(role) ? (
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
          </>
        )}
      </div>
    </AppShell>
  );
}
