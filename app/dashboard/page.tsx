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

const emptyDashboardRevenueMetrics: DashboardRevenueMetrics = {
  revenueThisMonth: 0,
  cashCollected: 0,
  bookedRevenue: 0,
  pendingIncoming: 0,
  overdueAmount: 0,
  averageDaysToPayment: null,
  outstandingInvoices: 0,
  outstandingInvoiceCount: 0,
  overdueInvoiceCount: 0,
  unpaidInvoiceTotal: 0,
  jobsCompleted: 0,
  jobsCompletedThisMonth: 0,
  activeCustomers: 0,
  customerCount: 0,
  upcomingJobs: 0,
  contractorPayThisMonth: 0,
  unpaidContractorPay: 0,
  pendingContractorPay: 0,
  otherExpensesThisMonth: 0,
  expenseTotalThisMonth: 0,
  netEstimateThisMonth: 0,
  netCashFlow: 0,
  bookingCountThisMonth: 0,
  messageCount: 0,
  reportCount: 0,
  jobsByStatus: {},
  totalJobs: 0
};

const OPEN_LEAD_STAGES = new Set(['open', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'reopened', 'lead']);
const CLOSED_LEAD_STAGES = new Set(['won', 'closed_lost', 'cancelled', 'lost']);

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

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [revenueMetrics, setRevenueMetrics] = useState<DashboardRevenueMetrics>(emptyDashboardRevenueMetrics);
  const [managerWorkspaceMetrics, setManagerWorkspaceMetrics] = useState<ManagerWorkspaceMetrics>(emptyManagerWorkspaceMetrics);
  const [crmMetrics, setCrmMetrics] = useState<CrmDashboardMetrics>(emptyCrmDashboardMetrics);
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
    const canViewFinancials = canAccessFinancials(userRole, userPlan);
    const customerScope = organizationId
      ? supabase.from('customers').select('id, record_type, pipeline_stage').eq('organization_id', organizationId).limit(10000)
      : supabase.from('customers').select('id, record_type, pipeline_stage').eq('user_id', user.id).limit(10000);

    const [metrics, usageCounts, jobsRes, activityRes, workersRes, customersRes] = await Promise.all([
      canViewFinancials ? fetchDashboardRevenueMetrics(supabase, organizationId) : Promise.resolve(emptyDashboardRevenueMetrics),
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
      customerScope
    ]);

    const assignedWorkerIds = new Set(
      ((workersRes.data || []) as { id: string; auth_user_id?: string | null }[])
        .filter((worker) => worker.auth_user_id === user.id)
        .map((worker) => worker.id)
    );

    const normalizedJobs = ((jobsRes.data || []) as DashboardJobRow[]).map(normalizeDashboardJob);
    const visibleJobs = staffView ? normalizedJobs.filter((job) => job.assigned_to && assignedWorkerIds.has(job.assigned_to)) : normalizedJobs;
    const rows = ((customersRes.data || []) as { id: string; record_type: string | null; pipeline_stage: string | null }[]);
    const leadRows = rows.filter((row) => row.record_type === 'lead');
    const customerRows = rows.filter((row) => !row.record_type || row.record_type === 'customer');
    const openLeadCount = leadRows.filter((row) => OPEN_LEAD_STAGES.has(row.pipeline_stage || 'open')).length;
    const closedLeadCount = leadRows.filter((row) => CLOSED_LEAD_STAGES.has(row.pipeline_stage || '')).length;
    const activeCustomerCount = customerRows.filter((row) => !row.pipeline_stage || row.pipeline_stage === 'active').length;
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
                <Link className="btn btn-sm" href="/customers">Customers</Link>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, alignItems: 'stretch' }}>
              {crmCard('Open leads', crmMetrics.openLeads, '/leads?status=open', 'New, contacted, qualified, proposal, and reopened leads.', salesCardStyle)}
              {crmCard('Closed leads', crmMetrics.closedLeads, '/leads?status=closed', 'Won, closed lost, and cancelled leads.', salesCardStyle)}
              {crmCard('Active customers', crmMetrics.activeCustomers, '/customers?status=active', 'Customers currently active in your workspace.', salesCardStyle)}
              {crmCard('Recurring customers', crmMetrics.recurringCustomers, '/customers?status=recurring', 'Customers marked as recurring service accounts.', salesCardStyle)}
              {crmCard('Inactive customers', crmMetrics.inactiveCustomers, '/customers?status=inactive', 'Inactive and former customers.', salesCardStyle)}
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
