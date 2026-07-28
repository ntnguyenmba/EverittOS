'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccessBlockedBanner } from '@/components/access-blocked-banner';
import { AppShell } from '@/components/app-shell';
import { DashboardIntegrationOverview } from '@/components/dashboard-integration-overview';
import { DashboardRevenueSnapshot } from '@/components/dashboard-revenue-snapshot';
import { useTranslation } from '@/components/locale-provider';
import { PageHeader } from '@/components/page-header';
import { fetchDashboardRevenueMetrics, type DashboardRevenueMetrics } from '@/lib/dashboard-metrics';
import { mapAccessError } from '@/lib/auth-errors';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchUsageCounts } from '@/lib/everittos-usage';
import { canAccessFinancials } from '@/lib/finance-access';
import { canAccessNavHref } from '@/lib/nav-access';
import {
  canManageOrganizationSettings,
  canViewTeam,
  isAdminRole,
  isClientRole,
  isContractorRole,
  isManagerRole,
  isStaffRole,
  normalizeRole,
  type UserRole
} from '@/lib/roles';
import { formatLocalDate } from '@/lib/schedule-times';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

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
  periodOutstanding: 0,
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
  periodUnpaidContractorPay: 0,
  unpaidContractorPay: 0,
  pendingContractorPay: 0,
  invoicePaymentsInPeriod: 0,
  directJobPaymentsInPeriod: 0,
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

const TIMEOUT_MS = 7000;

async function withTimeout<T>(task: PromiseLike<T>, fallback: T, timeoutMs = TIMEOUT_MS): Promise<T> {
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

function OverviewCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="stat-card"
      style={{
        minHeight: 104,
        textDecoration: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </Link>
  );
}

type OpsCounts = {
  activeJobs: number;
  todayJobs: number;
  openLeads: number;
  teamWorkingToday: number;
  customers: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [revenue, setRevenue] = useState<DashboardRevenueMetrics>(emptyRevenue);
  const [ops, setOps] = useState<OpsCounts>({
    activeJobs: 0,
    todayJobs: 0,
    openLeads: 0,
    teamWorkingToday: 0,
    customers: 0
  });

  async function loadDashboard() {
    setLoading(true);
    setLoadError(false);

    const auth = await withTimeout<{ data: { user: { id: string } | null }; error: Error | null }>(
      supabase.auth.getUser(),
      { data: { user: null }, error: new Error('Authentication timed out') },
      5000
    );
    const user = auth.data.user;

    if (!user) {
      router.replace('/login');
      return;
    }

    type ProfileRow = { plan?: string | null; role?: string | null };
    const [profileResult, organization] = await Promise.all([
      withTimeout<{ data: ProfileRow | null; error: Error | null }>(
        supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle(),
        { data: null, error: new Error('Profile timed out') },
        3500
      ),
      withTimeout(ensureOrganizationForUser(user.id), null, 3500)
    ]);

    const nextPlan = normalizePlan(profileResult.data?.plan);
    const nextRole = normalizeRole(organization?.role || profileResult.data?.role);

    if (isClientRole(nextRole)) {
      router.replace('/portal/client');
      return;
    }
    if (isContractorRole(nextRole)) {
      router.replace('/portal/contractor');
      return;
    }

    setPlan(nextPlan);
    setRole(nextRole);
    setReady(true);

    const organizationId = organization?.organizationId || null;
    const scopeColumn = organizationId ? 'organization_id' : 'user_id';
    const scopeValue = organizationId || user.id;
    const today = formatLocalDate(new Date());

    const [nextRevenue, usage, jobsResult, customersResult] = await Promise.all([
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
      withTimeout(
        supabase
          .from('jobs')
          .select('id, status, start_date, due_date, scheduled_start, assigned_to')
          .eq(scopeColumn, scopeValue)
          .limit(5000),
        { data: [], error: new Error('Jobs timed out') }
      ),
      withTimeout(
        supabase.from('customers').select('id, record_type, pipeline_stage').eq(scopeColumn, scopeValue).limit(10000),
        { data: [], error: new Error('Customers timed out') }
      )
    ]);

    const jobs = (jobsResult.data || []) as Array<{
      status: string | null;
      start_date?: string | null;
      due_date?: string | null;
      scheduled_start?: string | null;
      assigned_to?: string | null;
    }>;
    const customers = (customersResult.data || []) as Array<{
      record_type: string | null;
      pipeline_stage: string | null;
    }>;

    const activeJobs = jobs.filter((job) => !['completed', 'cancelled'].includes(job.status || ''));
    const todayJobs = activeJobs.filter((job) => {
      const date =
        (job.scheduled_start || '').slice(0, 10) ||
        (job.start_date || '').slice(0, 10) ||
        (job.due_date || '').slice(0, 10);
      return date === today;
    });
    const teamWorkingToday = new Set(
      todayJobs.map((job) => String(job.assigned_to || '').trim()).filter(Boolean)
    ).size;

    // Trust metric helpers — do not recompute expected revenue from mixed period/outstanding totals.
    setRevenue(nextRevenue);
    setOps({
      activeJobs: activeJobs.length,
      todayJobs: todayJobs.length,
      openLeads: customers.filter(
        (row) =>
          row.record_type === 'lead' &&
          !['won', 'closed_lost', 'cancelled', 'lost'].includes(row.pipeline_stage || 'open')
      ).length,
      teamWorkingToday,
      customers: usage.customers
    });

    setLoadError(Boolean(profileResult.error || jobsResult.error || customersResult.error || nextRevenue.loadFailed));
    setLoading(false);
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  if (!ready) {
    return (
      <main className="today-page dashboard-home" aria-busy="true">
        <section className="card" style={{ padding: 24 }}>
          <p className="loading-state" style={{ margin: 0 }}>
            {t('common.loading')}
          </p>
        </section>
      </main>
    );
  }

  const staffView = isStaffRole(role);
  const ownerView = isAdminRole(role);
  const managerView = isManagerRole(role) && !ownerView;
  const canLink = (href: string) => canAccessNavHref(role, href.split('?')[0], plan);

  return (
    <AppShell plan={plan} role={role} showBackButton={false}>
      <Suspense>
        <DashboardAccessNotice />
      </Suspense>

      <div className="today-page dashboard-home">
        <PageHeader
          title={
            staffView
              ? t('dashboard.myWork')
              : managerView
                ? 'Operations today'
                : t('dashboard.welcome')
          }
          subtitle={
            staffView
              ? t('dashboard.myWorkSubtitle')
              : managerView
                ? 'Today’s jobs, schedule, customers, and team activity.'
                : 'Cash, work, and what needs attention.'
          }
        />

        {loadError ? (
          <section
            className="card"
            role="status"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}
          >
            <p style={{ margin: 0 }}>Some information could not load. Available dashboard numbers are shown below.</p>
            <button className="btn btn-sm" type="button" onClick={() => void loadDashboard()} disabled={loading}>
              {loading ? 'Loading...' : 'Retry'}
            </button>
          </section>
        ) : null}

        {ownerView && canAccessFinancials(role, plan) ? (
          <Suspense fallback={<section className="card dashboard-today-card" style={{ minHeight: 300 }} aria-busy="true" />}>
            <DashboardRevenueSnapshot metrics={revenue} loading={loading} />
          </Suspense>
        ) : null}

        {ownerView && canManageOrganizationSettings(role) ? (
          <DashboardIntegrationOverview attentionOnly />
        ) : null}

        {!staffView ? (
          <section className="card" aria-label={managerView ? 'Manager overview' : 'Work overview'} style={{ minHeight: 0 }}>
            <div className="dashboard-section-head">
              <div>
                <h2>{managerView ? 'Today’s work' : 'Work overview'}</h2>
                <p className="page-subtitle" style={{ marginBottom: 0 }}>
                  {managerView
                    ? 'Operational snapshot for the day ahead.'
                    : 'Active work and today’s schedule.'}
                </p>
              </div>
            </div>

            <div
              className="stats-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 14,
                width: '100%'
              }}
            >
              {canLink('/jobs') ? (
                <OverviewCard label="Active Jobs" value={ops.activeJobs} href="/jobs?status=active" />
              ) : null}
              {canLink('/schedule') ? (
                <OverviewCard label="Today's Schedule" value={ops.todayJobs} href="/schedule" />
              ) : null}
              {canLink('/leads') ? (
                <OverviewCard label="Open Leads" value={ops.openLeads} href="/leads?status=open" />
              ) : null}
              {canViewTeam(role) && canLink('/people') ? (
                <OverviewCard label="Team Working Today" value={ops.teamWorkingToday} href="/people" />
              ) : null}
              {managerView && canLink('/customers') ? (
                <OverviewCard label="Customers" value={ops.customers} href="/customers" />
              ) : null}
            </div>

            {ops.activeJobs === 0 && ops.todayJobs === 0 ? (
              <p className="muted" style={{ marginTop: 16 }}>
                {managerView
                  ? 'No active jobs yet. Create a job or open the schedule to get the day started.'
                  : 'No active jobs yet. Create a job to start tracking work.'}
              </p>
            ) : null}
          </section>
        ) : (
          <section className="card" aria-label="My work">
            <div className="dashboard-section-head">
              <div>
                <h2>My work</h2>
                <p className="page-subtitle" style={{ marginBottom: 0 }}>Your assigned jobs and today’s schedule.</p>
              </div>
            </div>
            <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
              <Link className="btn btn-primary" href="/jobs?mine=true">
                My jobs
              </Link>
              <Link className="btn" href="/schedule">
                Schedule
              </Link>
            </div>
          </section>
        )}

        {(ownerView || managerView) && !staffView ? (
          <section className="card" style={{ minHeight: 0 }}>
            <div className="dashboard-section-head">
              <div>
                <h2>Quick actions</h2>
                <p className="page-subtitle" style={{ marginBottom: 0 }}>Common next steps.</p>
              </div>
            </div>
            <div className="inline-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              {canLink('/jobs') ? (
                <Link className="btn btn-primary" href="/jobs/new">
                  New Job
                </Link>
              ) : null}
              {canLink('/customers') ? (
                <Link className="btn" href="/customers/new">
                  New Customer
                </Link>
              ) : null}
              {canLink('/schedule') ? (
                <Link className="btn" href="/schedule">
                  Schedule
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
