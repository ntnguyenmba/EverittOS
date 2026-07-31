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
import { canAccessFinancials } from '@/lib/finance-access';
import { canAccessNavHref } from '@/lib/nav-access';
import {
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

const dashboardCopy = {
  en: {
    todaysWork: "Today's work",
    loadError: 'Some information could not load.',
    loading: 'Loading…',
    retry: 'Retry',
    today: 'Today',
    todaysJobs: "Today's Jobs",
    teamWorkingToday: 'Team Working Today',
    jobsNeedingAttention: 'Jobs Needing Attention',
    openLeads: 'Open Leads',
    myWork: 'My work',
    myJobs: 'My jobs',
    schedule: 'Schedule',
    newJob: 'New Job',
    newCustomer: 'New Customer'
  },
  es: {
    todaysWork: 'Trabajo de hoy',
    loadError: 'No se pudo cargar parte de la información.',
    loading: 'Cargando…',
    retry: 'Reintentar',
    today: 'Hoy',
    todaysJobs: 'Trabajos de hoy',
    teamWorkingToday: 'Equipo trabajando hoy',
    jobsNeedingAttention: 'Trabajos que requieren atención',
    openLeads: 'Prospectos abiertos',
    myWork: 'Mi trabajo',
    myJobs: 'Mis trabajos',
    schedule: 'Calendario',
    newJob: 'Nuevo trabajo',
    newCustomer: 'Nuevo cliente'
  },
  vi: {
    todaysWork: 'Công việc hôm nay',
    loadError: 'Một số thông tin không thể tải.',
    loading: 'Đang tải…',
    retry: 'Thử lại',
    today: 'Hôm nay',
    todaysJobs: 'Công việc hôm nay',
    teamWorkingToday: 'Nhân sự làm việc hôm nay',
    jobsNeedingAttention: 'Công việc cần chú ý',
    openLeads: 'Khách tiềm năng đang mở',
    myWork: 'Công việc của tôi',
    myJobs: 'Công việc của tôi',
    schedule: 'Lịch',
    newJob: 'Công việc mới',
    newCustomer: 'Khách hàng mới'
  }
} as const;

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
  totalJobs: 0,
  scheduledRevenue: 0,
  recurringOccurrenceCount: 0,
  oneTimeJobCount: 0
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

function SimpleStat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="dashboard-revenue-metric is-primary" style={{ minHeight: 120, textDecoration: 'none' }}>
      <span className="dashboard-revenue-metric-label">{label}</span>
      <strong className="dashboard-revenue-metric-value">{value}</strong>
    </Link>
  );
}

type OpsCounts = {
  todayJobs: number;
  needsAttention: number;
  openLeads: number;
  teamWorkingToday: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const c = dashboardCopy[locale];
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [revenue, setRevenue] = useState<DashboardRevenueMetrics>(emptyRevenue);
  const [ops, setOps] = useState<OpsCounts>({ todayJobs: 0, needsAttention: 0, openLeads: 0, teamWorkingToday: 0 });

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
    const ownerFinance = canAccessFinancials(nextRole, nextPlan);

    const [nextRevenue, jobsResult, customersResult] = await Promise.all([
      ownerFinance
        ? withTimeout(fetchDashboardRevenueMetrics(supabase, organizationId), { ...emptyRevenue, loadFailed: true })
        : Promise.resolve(emptyRevenue),
      withTimeout(
        supabase.from('jobs').select('id, status, start_date, due_date, scheduled_start, assigned_to').eq(scopeColumn, scopeValue).limit(5000),
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
    const customers = (customersResult.data || []) as Array<{ record_type: string | null; pipeline_stage: string | null }>;

    const activeJobs = jobs.filter((job) => !['completed', 'cancelled', 'canceled'].includes(job.status || ''));
    const todayJobs = activeJobs.filter((job) => {
      const date = (job.scheduled_start || '').slice(0, 10) || (job.start_date || '').slice(0, 10) || (job.due_date || '').slice(0, 10);
      return date === today;
    });
    const needsAttention = activeJobs.filter((job) => {
      const status = String(job.status || '').toLowerCase();
      const due = (job.due_date || '').slice(0, 10);
      return !job.assigned_to || status === 'new' || (due && due < today);
    }).length;

    setRevenue(nextRevenue);
    setOps({
      todayJobs: todayJobs.length,
      needsAttention,
      openLeads: customers.filter((row) => row.record_type === 'lead' && !['won', 'closed_lost', 'cancelled', 'lost'].includes(row.pipeline_stage || 'open')).length,
      teamWorkingToday: new Set(todayJobs.map((job) => String(job.assigned_to || '').trim()).filter(Boolean)).size
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
        <section style={{ padding: 24 }}><p className="loading-state" style={{ margin: 0 }}>{t('common.loading')}</p></section>
      </main>
    );
  }

  const staffView = isStaffRole(role);
  const ownerView = isAdminRole(role);
  const managerView = isManagerRole(role) && !ownerView;
  const canLink = (href: string) => canAccessNavHref(role, href.split('?')[0], plan);
  const showFinance = ownerView && canAccessFinancials(role, plan);

  return (
    <AppShell plan={plan} role={role} showBackButton={false}>
      <Suspense><DashboardAccessNotice /></Suspense>

      <div className="today-page dashboard-home">
        <PageHeader title={staffView ? t('dashboard.myWork') : managerView ? c.todaysWork : t('dashboard.welcome')} />

        {loadError ? (
          <section role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <p className="muted" style={{ margin: 0 }}>{c.loadError}</p>
            <button className="btn btn-sm" type="button" onClick={() => void loadDashboard()} disabled={loading}>{loading ? c.loading : c.retry}</button>
          </section>
        ) : null}

        {showFinance ? (
          <Suspense fallback={<div style={{ minHeight: 140 }} aria-busy="true" />}>
            <DashboardRevenueSnapshot metrics={revenue} todayJobs={ops.todayJobs} loading={loading} />
          </Suspense>
        ) : null}

        {managerView ? (
          <section aria-label={c.today} style={{ marginTop: showFinance ? 24 : 0 }}>
            <div className="dashboard-revenue-grid">
              {canLink('/schedule') ? <SimpleStat label={c.todaysJobs} value={ops.todayJobs} href="/schedule" /> : null}
              {canViewTeam(role) && canLink('/people') ? <SimpleStat label={c.teamWorkingToday} value={ops.teamWorkingToday} href="/people" /> : null}
              {canLink('/jobs') ? <SimpleStat label={c.jobsNeedingAttention} value={ops.needsAttention} href="/jobs?status=active" /> : null}
              {canLink('/leads') || canLink('/customers') ? <SimpleStat label={c.openLeads} value={ops.openLeads} href="/customers?stage=leads" /> : null}
            </div>
          </section>
        ) : null}

        {staffView ? (
          <section aria-label={c.myWork} style={{ marginTop: 8 }}>
            <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
              <Link className="btn btn-primary" href="/jobs?mine=true">{c.myJobs}</Link>
              <Link className="btn" href="/schedule">{c.schedule}</Link>
            </div>
          </section>
        ) : null}

        {(ownerView || managerView) && !staffView ? (
          <div className="inline-actions" style={{ marginTop: 28, justifyContent: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            {canLink('/jobs') ? <Link className="btn btn-primary" href="/jobs/new">{c.newJob}</Link> : null}
            {canLink('/customers') ? <Link className="btn" href="/customers/new">{c.newCustomer}</Link> : null}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
