'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccessBlockedBanner } from '@/components/access-blocked-banner';
import { AppShell } from '@/components/app-shell';
import { DashboardRevenueSnapshot } from '@/components/dashboard-revenue-snapshot';
import { useTranslation } from '@/components/locale-provider';
import { PageHeader } from '@/components/page-header';
import {
  fetchDashboardRevenueMetrics,
  filterValidJobsInPeriod,
  type DashboardRevenueMetrics,
  type JobCountRow
} from '@/lib/dashboard-metrics';
import { mapAccessError } from '@/lib/auth-errors';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canAccessFinancials } from '@/lib/finance-access';
import { canAccessNavHref } from '@/lib/nav-access';
import {
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
    jobsNeedingAttention: 'Needs Attention',
    openLeads: 'Open Leads',
    myWork: 'My work',
    myJobs: 'My jobs',
    schedule: 'Schedule',
    newJob: 'New Job',
    quotes: 'Quotes',
    nextJob: 'Next job',
    noUpcomingJob: 'No upcoming job',
    quotesWaiting: 'Quotes waiting',
    moneyLate: 'Money late',
    moneyDetails: 'Money details'
  },
  es: {
    todaysWork: 'Trabajo de hoy',
    loadError: 'No se pudo cargar parte de la información.',
    loading: 'Cargando…',
    retry: 'Reintentar',
    today: 'Hoy',
    todaysJobs: 'Trabajos de hoy',
    jobsNeedingAttention: 'Necesita atención',
    openLeads: 'Prospectos abiertos',
    myWork: 'Mi trabajo',
    myJobs: 'Mis trabajos',
    schedule: 'Calendario',
    newJob: 'Nuevo trabajo',
    quotes: 'Cotizaciones',
    nextJob: 'Próximo trabajo',
    noUpcomingJob: 'No hay trabajo próximo',
    quotesWaiting: 'Cotizaciones pendientes',
    moneyLate: 'Dinero atrasado',
    moneyDetails: 'Detalles de dinero'
  },
  vi: {
    todaysWork: 'Công việc hôm nay',
    loadError: 'Một số thông tin không thể tải.',
    loading: 'Đang tải…',
    retry: 'Thử lại',
    today: 'Hôm nay',
    todaysJobs: 'Công việc hôm nay',
    jobsNeedingAttention: 'Cần chú ý',
    openLeads: 'Khách tiềm năng đang mở',
    myWork: 'Công việc của tôi',
    myJobs: 'Công việc của tôi',
    schedule: 'Lịch',
    newJob: 'Công việc mới',
    quotes: 'Báo giá',
    nextJob: 'Công việc tiếp theo',
    noUpcomingJob: 'Không có công việc sắp tới',
    quotesWaiting: 'Báo giá đang chờ',
    moneyLate: 'Tiền quá hạn',
    moneyDetails: 'Chi tiết tiền'
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
  scheduledExpectedContractorExpense: 0,
  scheduledExpectedAdditionalExpenses: 0,
  scheduledExpectedProfit: 0,
  recurringOccurrenceCount: 0,
  oneTimeJobCount: 0,
  activeRecurringScheduleCount: 0,
  pausedRecurringScheduleCount: 0,
  recurringCustomerCount: 0,
  completedRecurringOccurrenceCount: 0,
  cancelledRecurringOccurrenceCount: 0
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

function PriorityStat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="dashboard-revenue-metric is-primary" style={{ minHeight: 120, textDecoration: 'none' }}>
      <span className="dashboard-revenue-metric-label">{label}</span>
      <strong className="dashboard-revenue-metric-value">{value}</strong>
    </Link>
  );
}

function OwnerDeskCard({ label, value, detail, href, kind = 'metric' }: { label: string; value: string; detail?: string; href: string; kind?: 'job' | 'metric' | 'money' }) {
  const kindClass = kind === 'job' ? ' owner-next-job-card' : kind === 'money' ? ' owner-money-card' : '';
  return (
    <Link href={href} className={`dashboard-revenue-metric is-primary owner-desk-card${kindClass}`} style={{ textDecoration: 'none' }}>
      <span className="dashboard-revenue-metric-label">{label}</span>
      <strong className="dashboard-revenue-metric-value">{value}</strong>
      {detail ? <span className="muted" style={{ marginTop: 8 }}>{detail}</span> : null}
    </Link>
  );
}

type DashboardJob = JobCountRow & {
  id: string;
  title?: string | null;
  customer_name?: string | null;
  address?: string | null;
  assigned_to?: string | null;
  scheduled_start?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  is_skipped?: boolean | null;
};

type NextJob = { id: string; title: string; detail: string };
type OpsCounts = { todayJobs: number; needsAttention: number; openLeads: number; singleOpenLeadId: string | null; quotesWaiting: number; nextJob: NextJob | null };

function jobDateValue(job: DashboardJob) {
  const value = job.scheduled_start || job.start_date || job.due_date || '';
  if (!value) return null;
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatNextJobDetail(job: DashboardJob, locale: string) {
  const value = jobDateValue(job);
  const date = value ? new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', ...(job.scheduled_start ? { hour: 'numeric', minute: '2-digit' } : {}) }).format(value) : '';
  return [date, job.customer_name, job.address].filter(Boolean).join(' · ');
}

function formatMoney(value: number, locale: string) {
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : locale === 'es' ? 'es-US' : 'en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
}

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
  const [ops, setOps] = useState<OpsCounts>({ todayJobs: 0, needsAttention: 0, openLeads: 0, singleOpenLeadId: null, quotesWaiting: 0, nextJob: null });

  async function loadDashboard() {
    setLoading(true);
    setLoadError(false);
    const auth = await withTimeout<{ data: { user: { id: string } | null }; error: Error | null }>(supabase.auth.getUser(), { data: { user: null }, error: new Error('Authentication timed out') }, 5000);
    const user = auth.data.user;
    if (!user) { router.replace('/login'); return; }

    type ProfileRow = { plan?: string | null; role?: string | null };
    const [profileResult, organization] = await Promise.all([
      withTimeout<{ data: ProfileRow | null; error: Error | null }>(supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle(), { data: null, error: new Error('Profile timed out') }, 3500),
      withTimeout(ensureOrganizationForUser(user.id), null, 3500)
    ]);

    const nextPlan = normalizePlan(profileResult.data?.plan);
    const nextRole = normalizeRole(organization?.role || profileResult.data?.role);
    if (isClientRole(nextRole)) { router.replace('/portal/client'); return; }
    if (isContractorRole(nextRole)) { router.replace('/portal/contractor'); return; }
    setPlan(nextPlan); setRole(nextRole); setReady(true);

    const organizationId = organization?.organizationId || null;
    const scopeColumn = organizationId ? 'organization_id' : 'user_id';
    const scopeValue = organizationId || user.id;
    const today = formatLocalDate(new Date());
    const ownerFinance = canAccessFinancials(nextRole, nextPlan);
    const quotesTask = organizationId ? withTimeout(supabase.from('quotes').select('id, status').eq('organization_id', organizationId).in('status', ['draft', 'shared']), { data: [], error: null }) : Promise.resolve({ data: [], error: null });

    const [nextRevenue, jobsResult, customersResult, quotesResult] = await Promise.all([
      ownerFinance ? withTimeout(fetchDashboardRevenueMetrics(supabase, organizationId), { ...emptyRevenue, loadFailed: true }) : Promise.resolve(emptyRevenue),
      withTimeout(supabase.from('jobs').select('id, title, customer_name, address, status, start_date, due_date, scheduled_start, completed_at, created_at, assigned_to, is_skipped, recurring_series_id, occurrence_date').eq(scopeColumn, scopeValue).limit(5000), { data: [], error: new Error('Jobs timed out') }),
      withTimeout(supabase.from('customers').select('id, record_type, pipeline_stage').eq(scopeColumn, scopeValue).limit(10000), { data: [], error: new Error('Customers timed out') }),
      quotesTask
    ]);

    const jobs = (jobsResult.data || []) as DashboardJob[];
    const customers = (customersResult.data || []) as Array<{ id: string; record_type: string | null; pipeline_stage: string | null }>;
    const todayJobs = filterValidJobsInPeriod(jobs, 'today');
    const activeJobs = jobs.filter((job) => !['completed', 'complete', 'done', 'finished', 'closed', 'cancelled', 'canceled', 'draft', 'skipped'].includes(String(job.status || '').toLowerCase()) && !job.is_skipped);
    const needsAttention = activeJobs.filter((job) => { const status = String(job.status || '').toLowerCase(); const due = (job.due_date || '').slice(0, 10); return !job.assigned_to || status === 'new' || Boolean(due && due < today); }).length;
    const openLeadRows = customers.filter((row) => row.record_type === 'lead' && !['won', 'closed_lost', 'cancelled', 'lost'].includes(row.pipeline_stage || 'open'));
    const nextJobRow = activeJobs.filter((job) => { const date = jobDateValue(job); return date && formatLocalDate(date) >= today; }).sort((a, b) => (jobDateValue(a)?.getTime() || Number.MAX_SAFE_INTEGER) - (jobDateValue(b)?.getTime() || Number.MAX_SAFE_INTEGER))[0] || null;

    setRevenue(nextRevenue);
    setOps({ todayJobs: todayJobs.length, needsAttention, openLeads: openLeadRows.length, singleOpenLeadId: openLeadRows.length === 1 ? openLeadRows[0].id : null, quotesWaiting: Array.isArray(quotesResult.data) ? quotesResult.data.length : 0, nextJob: nextJobRow ? { id: nextJobRow.id, title: String(nextJobRow.title || nextJobRow.customer_name || c.nextJob), detail: formatNextJobDetail(nextJobRow, locale === 'vi' ? 'vi-VN' : locale === 'es' ? 'es-US' : 'en-US') } : null });
    setLoadError(Boolean(profileResult.error || jobsResult.error || customersResult.error || nextRevenue.loadFailed));
    setLoading(false);
  }

  useEffect(() => {
    void loadDashboard();
    const onFocus = () => void loadDashboard();
    const onVisible = () => { if (document.visibilityState === 'visible') void loadDashboard(); };
    window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  if (!ready) return <main className="today-page dashboard-home" aria-busy="true"><section style={{ padding: 24 }}><p className="loading-state" style={{ margin: 0 }}>{t('common.loading')}</p></section></main>;

  const staffView = isStaffRole(role);
  const ownerView = isAdminRole(role);
  const managerView = isManagerRole(role) && !ownerView;
  const canLink = (href: string) => canAccessNavHref(role, href.split('?')[0], plan);
  const showFinance = ownerView && canAccessFinancials(role, plan);
  const showOperations = (ownerView || managerView) && !staffView;
  const openLeadsHref = ops.singleOpenLeadId ? `/leads/${ops.singleOpenLeadId}` : '/leads';

  return (
    <AppShell plan={plan} role={role} showBackButton={false}>
      <Suspense><DashboardAccessNotice /></Suspense>
      <div className="today-page dashboard-home">
        <PageHeader title={staffView ? t('dashboard.myWork') : managerView ? c.todaysWork : t('dashboard.welcome')} />
        {loadError ? <section role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}><p className="muted" style={{ margin: 0 }}>{c.loadError}</p><button className="btn btn-sm" type="button" onClick={() => void loadDashboard()} disabled={loading}>{loading ? c.loading : c.retry}</button></section> : null}

        {ownerView ? (
          <section aria-label={c.today} className="dashboard-operations owner-priority-strip">
            <div className="dashboard-revenue-grid">
              <OwnerDeskCard kind="job" label={c.nextJob} value={ops.nextJob?.title || c.noUpcomingJob} detail={ops.nextJob?.detail} href={ops.nextJob ? `/jobs/${ops.nextJob.id}` : '/schedule'} />
              {canLink('/quotes') ? <OwnerDeskCard label={c.quotesWaiting} value={String(ops.quotesWaiting)} href="/quotes" /> : null}
              {showFinance ? <OwnerDeskCard kind="money" label={c.moneyLate} value={formatMoney(Number(revenue.overdueAmount || 0), locale)} href="/dashboard/details?metric=late" /> : null}
            </div>
          </section>
        ) : showOperations ? (
          <section aria-label={c.today} className="dashboard-operations"><div className="dashboard-revenue-grid">
            {canLink('/schedule') ? <PriorityStat label={c.todaysJobs} value={ops.todayJobs} href="/schedule" /> : null}
            {canLink('/jobs') ? <PriorityStat label={c.jobsNeedingAttention} value={ops.needsAttention} href="/jobs?status=active" /> : null}
            {canLink('/leads') ? <PriorityStat label={c.openLeads} value={ops.openLeads} href={openLeadsHref} /> : null}
          </div></section>
        ) : null}

        {showFinance ? (
          <details className="card owner-money-details">
            <summary><strong>{c.moneyDetails}</strong></summary>
            <div className="owner-money-details-body"><Suspense fallback={<div style={{ minHeight: 140 }} aria-busy="true" />}><DashboardRevenueSnapshot metrics={revenue} loading={loading} /></Suspense></div>
          </details>
        ) : null}

        {staffView ? <section aria-label={c.myWork} style={{ marginTop: 8 }}><div className="inline-actions" style={{ flexWrap: 'wrap' }}><Link className="btn btn-primary" href="/jobs?mine=true">{c.myJobs}</Link><Link className="btn" href="/schedule">{c.schedule}</Link></div></section> : null}

        {showOperations ? <div className="inline-actions owner-primary-actions" style={{ marginTop: 28, justifyContent: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          {canLink('/jobs') ? <Link className="btn btn-primary" href="/jobs/new">{c.newJob}</Link> : null}
          {canLink('/quotes') ? <Link className="btn" href="/quotes">{c.quotes}</Link> : null}
        </div> : null}
      </div>
    </AppShell>
  );
}
