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
import { canManageOrganizationSettings, isClientRole, isContractorRole, isStaffRole, normalizeRole, type UserRole } from '@/lib/roles';
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
    <Link href={href} className="stat-card" style={{ minHeight: 112, textDecoration: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [revenue, setRevenue] = useState<DashboardRevenueMetrics>(emptyRevenue);
  const [counts, setCounts] = useState({ jobs: 0, customers: 0, photos: 0, reports: 0, team: 0, activeJobs: 0, completedJobs: 0, openLeads: 0 });

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

    setReady(true);

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
    const scopeColumn = organizationId ? 'organization_id' : 'user_id';
    const scopeValue = organizationId || user.id;

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
        supabase.from('jobs').select('id, status').eq(scopeColumn, scopeValue).limit(5000),
        { data: [], error: new Error('Jobs timed out') }
      ),
      withTimeout(
        supabase.from('customers').select('id, record_type, pipeline_stage').eq(scopeColumn, scopeValue).limit(10000),
        { data: [], error: new Error('Customers timed out') }
      )
    ]);

    const jobs = (jobsResult.data || []) as Array<{ status: string | null }>;
    const customers = (customersResult.data || []) as Array<{ record_type: string | null; pipeline_stage: string | null }>;

    setRevenue(nextRevenue);
    setCounts({
      jobs: usage.jobs,
      customers: usage.customers,
      photos: usage.photos,
      reports: usage.reports,
      team: usage.teamMembers,
      activeJobs: jobs.filter((job) => !['completed', 'cancelled'].includes(job.status || '')).length,
      completedJobs: jobs.filter((job) => job.status === 'completed').length,
      openLeads: customers.filter((row) => row.record_type === 'lead' && !['won', 'closed_lost', 'cancelled', 'lost'].includes(row.pipeline_stage || 'open')).length
    });

    setLoadError(Boolean(profileResult.error || jobsResult.error || customersResult.error || nextRevenue.loadFailed));
    setLoading(false);
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const staffView = isStaffRole(role);

  return (
    <AppShell plan={plan} role={role} showBackButton={false}>
      <Suspense><DashboardAccessNotice /></Suspense>

      <div className="today-page dashboard-home">
        <PageHeader
          title={staffView ? t('dashboard.myWork') : t('dashboard.welcome')}
          subtitle={staffView ? t('dashboard.myWorkSubtitle') : t('dashboard.navSubtitle')}
        />

        {!ready ? (
          <section className="card" aria-busy="true" style={{ padding: 24 }}>
            <p className="loading-state" style={{ margin: 0 }}>{t('common.loading')}</p>
          </section>
        ) : (
          <>
            {loadError ? (
              <section className="card" role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <p style={{ margin: 0 }}>Some information could not load. The available dashboard information is shown below.</p>
                <button className="btn btn-sm" type="button" onClick={() => void loadDashboard()} disabled={loading}>
                  {loading ? 'Loading...' : 'Retry'}
                </button>
              </section>
            ) : null}

            {canAccessFinancials(role, plan) ? <DashboardRevenueSnapshot metrics={revenue} loading={loading} /> : null}
            {canManageOrganizationSettings(role) ? <DashboardIntegrationOverview /> : null}

            <section className="card" aria-label="Operations overview" style={{ minHeight: 0 }}>
              <div className="dashboard-section-head">
                <div>
                  <h2>Operations overview</h2>
                  <p className="page-subtitle" style={{ marginBottom: 0 }}>Your current jobs, customers, leads, photos, reports, and team.</p>
                </div>
              </div>

              <div className="stats-grid">
                <OverviewCard label="Active jobs" value={counts.activeJobs} href="/jobs?status=active" />
                <OverviewCard label="Completed jobs" value={counts.completedJobs} href="/jobs?status=completed" />
                <OverviewCard label="Open leads" value={counts.openLeads} href="/leads?status=open" />
                <OverviewCard label="Customers" value={counts.customers} href="/customers" />
                <OverviewCard label="Photos" value={counts.photos} href="/photos" />
                <OverviewCard label="Reports" value={counts.reports} href="/reports" />
                <OverviewCard label="Team members" value={counts.team} href="/people" />
                <OverviewCard label="All jobs" value={counts.jobs} href="/jobs" />
              </div>
            </section>

            <section className="card" style={{ minHeight: 0 }}>
              <div className="dashboard-section-head">
                <div>
                  <h2>Quick actions</h2>
                  <p className="page-subtitle" style={{ marginBottom: 0 }}>Go directly to the work you need.</p>
                </div>
              </div>
              <div className="inline-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                <Link className="btn btn-primary" href="/jobs/new">Create job</Link>
                <Link className="btn" href="/customers/new">Add customer</Link>
                <Link className="btn" href="/leads/new">Add lead</Link>
                <Link className="btn" href="/schedule">Open schedule</Link>
                <Link className="btn" href="/invoices">Open invoices</Link>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
