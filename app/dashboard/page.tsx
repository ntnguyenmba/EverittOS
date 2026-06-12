'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccessBlockedBanner } from '@/components/access-blocked-banner';
import { ActivityFeed } from '@/components/activity-feed';
import { AppShell } from '@/components/app-shell';
import { JobCreator } from '@/components/job-creator';
import { useTranslation } from '@/components/locale-provider';
import { PageHeader } from '@/components/page-header';
import { UsageDashboard } from '@/components/usage-dashboard';
import { mapAccessError } from '@/lib/auth-errors';
import { filterDemoSeedJobs } from '@/lib/demo-seed-filter';
import { limitsForPlan } from '@/lib/everittos-limits';
import { fetchUsageCounts, type UsageCounts } from '@/lib/everittos-usage';
import { billingUpgradeHref } from '@/lib/nav-access';
import { fetchOrganizationContext } from '@/lib/organization';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
import { hasTeamManagement, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import type { Locale } from '@/lib/i18n/config';
import { isClientRole, normalizeRole, type UserRole } from '@/lib/roles';
import { friendlyErrorMessage } from '@/lib/user-errors';
import { supabase } from '@/lib/supabase';

type Job = {
  id: string;
  title: string;
  customer_name: string | null;
  status: string | null;
  start_date: string | null;
  due_date: string | null;
  assigned_to: string | null;
  completed_at: string | null;
};

type ActivityItem = {
  id: string;
  action: string;
  message: string | null;
  entity_type: string;
  created_at: string | null;
  actor_name: string | null;
};

const LOCALE_TAGS: Record<Locale, string> = {
  en: 'en-US',
  es: 'es',
  vi: 'vi-VN'
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function weekAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function formatMoney(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale], {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
}

function DashboardAccessNotice() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');
  const detail = searchParams.get('detail');
  if (!reason) return null;
  const mapped = mapAccessError(reason);
  return (
    <AccessBlockedBanner title={mapped.title} message={mapped.message} details={detail || mapped.details} />
  );
}

const QUICK_LINKS = [
  { key: 'jobs', href: '/jobs' },
  { key: 'notifications', href: '/notifications' },
  { key: 'settings', href: '/settings' },
  { key: 'activity', href: '/activity', minPlan: 'business' as const }
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [displayName, setDisplayName] = useState('');
  const [unpaidInvoices, setUnpaidInvoices] = useState(0);
  const [revenueMonth, setRevenueMonth] = useState(0);
  const [pendingProposals, setPendingProposals] = useState(0);
  const [usageCounts, setUsageCounts] = useState<UsageCounts | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [leadCount, setLeadCount] = useState(0);
  const [clientCount, setClientCount] = useState(0);
  const [newCustomersMonth, setNewCustomersMonth] = useState(0);
  const [todayTasks, setTodayTasks] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showNewJob, setShowNewJob] = useState(false);
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
      .select('plan, role, full_name, business_name')
      .eq('id', user.id)
      .maybeSingle();
    const org = await fetchOrganizationContext(user.id);
    const userPlan = normalizePlan(profile?.plan);
    setRole(normalizeRole(profile?.role));
    setDisplayName(profile?.full_name?.trim() || profile?.business_name?.trim() || '');

    if (!org) {
      await fetch('/api/auth/setup', { method: 'POST' });
    }

    setPlan(userPlan);

    let jobsQuery = supabase
      .from('jobs')
      .select('id, title, customer_name, status, start_date, due_date, assigned_to, completed_at')
      .order('created_at', { ascending: false });
    if (org?.organizationId) {
      jobsQuery = jobsQuery.eq('organization_id', org.organizationId);
    } else {
      jobsQuery = jobsQuery.eq('user_id', user.id);
    }

    const invoiceOpenQuery = org?.organizationId
      ? supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.organizationId)
          .neq('status', 'paid')
          .neq('status', 'cancelled')
      : Promise.resolve({ count: 0, error: null });

    const invoicePaidQuery = org?.organizationId
      ? supabase
          .from('invoices')
          .select('amount')
          .eq('organization_id', org.organizationId)
          .eq('status', 'paid')
          .gte('created_at', monthStartIso())
      : Promise.resolve({ data: [], error: null });

    const proposalsQuery = org?.organizationId
      ? supabase
          .from('proposals')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.organizationId)
          .in('status', ['draft', 'sent', 'pending', 'open'])
      : Promise.resolve({ count: 0, error: null });

    const activityQuery =
      org?.organizationId && limitsForPlan(userPlan).activityLog
        ? supabase
            .from('activity_logs')
            .select('id, action, message, entity_type, created_at, actor_name')
            .eq('organization_id', org.organizationId)
            .order('created_at', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [], error: null });

    const customersQuery = org?.organizationId
      ? supabase.from('customers').select('id, pipeline_stage, created_at').eq('organization_id', org.organizationId)
      : supabase.from('customers').select('id, pipeline_stage, created_at').eq('user_id', user.id);

    const tasksQuery = org?.organizationId
      ? supabase
          .from('os_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.organizationId)
          .eq('due_date', todayIso())
          .neq('status', 'done')
      : Promise.resolve({ count: 0, error: null });

    const notificationsQuery = supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null);

    const [
      jobsRes,
      orgIsDemo,
      invoiceOpenRes,
      invoicePaidRes,
      proposalsRes,
      activityRes,
      counts,
      customersRes,
      tasksRes,
      notifRes
    ] = await Promise.all([
      jobsQuery,
      fetchOrganizationIsDemo(supabase, org?.organizationId),
      invoiceOpenQuery,
      invoicePaidQuery,
      proposalsQuery,
      activityQuery,
      fetchUsageCounts(user.id, org?.organizationId),
      customersQuery,
      tasksQuery,
      notificationsQuery
    ]);

    setLoading(false);

    if (jobsRes.error) {
      setErrorMessage(jobsRes.error.message);
      return;
    }

    setJobs(filterDemoSeedJobs(jobsRes.data || [], orgIsDemo));
    if (!invoiceOpenRes.error) setUnpaidInvoices(invoiceOpenRes.count || 0);
    if (!invoicePaidRes.error && invoicePaidRes.data) {
      const total = (invoicePaidRes.data as { amount: number | null }[]).reduce(
        (sum, row) => sum + (Number(row.amount) || 0),
        0
      );
      setRevenueMonth(total);
    }
    if (!proposalsRes.error) setPendingProposals(proposalsRes.count || 0);
    if (!activityRes.error) setRecentActivity(activityRes.data || []);
    setUsageCounts(counts);

    const monthStart = monthStartIso();
    if (!customersRes.error && customersRes.data) {
      const rows = customersRes.data as { id: string; pipeline_stage?: string | null; created_at?: string | null }[];
      setLeadCount(rows.filter((c) => c.pipeline_stage === 'lead' || c.pipeline_stage === 'qualified').length);
      setClientCount(
        rows.filter((c) => !c.pipeline_stage || c.pipeline_stage === 'won' || c.pipeline_stage === 'contact').length
      );
      setNewCustomersMonth(rows.filter((c) => c.created_at && c.created_at >= monthStart).length);
    } else {
      setClientCount(counts.customers);
    }

    if (!tasksRes.error) setTodayTasks(tasksRes.count || 0);
    if (!notifRes.error) setUnreadNotifications(notifRes.count || 0);

    if (isClientRole(normalizeRole(profile?.role))) {
      router.push('/portal/client');
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const today = todayIso();
  const showActivity = limitsForPlan(plan).activityLog;
  const weekAgo = weekAgoIso();

  const completedThisWeek = useMemo(
    () =>
      jobs.filter(
        (j) =>
          j.status === 'completed' &&
          j.completed_at &&
          new Date(j.completed_at).getTime() >= new Date(weekAgo).getTime()
      ).length,
    [jobs, weekAgo]
  );

  const unassignedJobs = useMemo(
    () =>
      jobs.filter(
        (j) => j.status !== 'completed' && j.status !== 'cancelled' && !j.assigned_to
      ).length,
    [jobs]
  );

  const dueInSevenDays = useMemo(() => {
    const weekAhead = new Date();
    weekAhead.setDate(weekAhead.getDate() + 7);
    const end = weekAhead.toISOString().slice(0, 10);
    return jobs.filter(
      (j) =>
        j.status !== 'completed' &&
        j.status !== 'cancelled' &&
        ((j.due_date && j.due_date >= today && j.due_date <= end) ||
          (j.start_date && j.start_date >= today && j.start_date <= end))
    ).length;
  }, [jobs, today]);

  const todayJobs = useMemo(
    () =>
      jobs
        .filter((j) => j.status !== 'cancelled' && (j.start_date === today || j.due_date === today))
        .slice(0, 5),
    [jobs, today]
  );

  function workersHref(): string {
    if (!hasTeamManagement(plan)) {
      return billingUpgradeHref('business', t('dashboard.quickActions.addWorker'));
    }
    return '/workers';
  }

  function quickLinkHref(link: (typeof QUICK_LINKS)[number]): string {
    if ('minPlan' in link && link.minPlan && !limitsForPlan(plan).activityLog) {
      return billingUpgradeHref(link.minPlan, t(`dashboard.quickLinks.${link.key}`));
    }
    return link.href;
  }

  const attentionItems = [
    { key: 'overdueInvoices', count: unpaidInvoices, href: '/settings/billing' },
    { key: 'unassignedJobs', count: unassignedJobs, href: '/jobs' },
    { key: 'pendingEstimates', count: pendingProposals, href: '/proposals' },
    { key: 'followUpCustomers', count: leadCount, href: '/customers' },
    { key: 'upcomingAppointments', count: dueInSevenDays, href: '/schedule' }
  ].filter((item) => item.count > 0);

  const welcomeSubtitle = displayName
    ? t('dashboard.welcomeName', { name: displayName })
    : t('dashboard.subtitle');

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

      <div className="today-page">
        <PageHeader
          title={t('dashboard.title')}
          subtitle={welcomeSubtitle}
          action={
            <button type="button" className="btn btn-primary" onClick={() => setShowNewJob((v) => !v)}>
              {t('dashboard.newJob')}
            </button>
          }
        />

        <section aria-label={t('ux.progressTitle')}>
          <h2 className="section-heading">{t('ux.progressTitle')}</h2>
          <div className="progress-cards">
            <div className="progress-card">
              <span>{t('dashboard.progress.completedWeek')}</span>
              <strong>{loading ? '…' : completedThisWeek}</strong>
            </div>
            <div className="progress-card">
              <span>{t('dashboard.progress.revenueMonth')}</span>
              <strong>{loading ? '…' : formatMoney(revenueMonth, locale)}</strong>
            </div>
            <div className="progress-card">
              <span>{t('dashboard.progress.newCustomersMonth')}</span>
              <strong>{loading ? '…' : newCustomersMonth}</strong>
            </div>
            <div className="progress-card">
              <span>{t('dashboard.progress.openInvoices')}</span>
              <strong>{loading ? '…' : unpaidInvoices}</strong>
            </div>
            <div className="progress-card">
              <span>{t('dashboard.progress.scheduledUpcoming')}</span>
              <strong>{loading ? '…' : dueInSevenDays}</strong>
            </div>
          </div>
        </section>

        <section aria-label={t('dashboard.primaryActions')}>
          <h2 className="section-heading">{t('dashboard.primaryActions')}</h2>
          <div className="quick-actions-grid">
            <button
              type="button"
              className="quick-action-tile quick-action-tile-primary"
              onClick={() => setShowNewJob(true)}
            >
              {t('dashboard.quickActions.createJob')}
            </button>
            <Link href="/customers" className="quick-action-tile">
              {t('dashboard.quickActions.addCustomer')}
            </Link>
            <Link href="/settings/billing" className="quick-action-tile">
              {t('dashboard.quickActions.sendInvoice')}
            </Link>
            <Link href="/schedule" className="quick-action-tile">
              {t('dashboard.quickActions.scheduleWork')}
            </Link>
            <Link href={workersHref()} className="quick-action-tile">
              {t('dashboard.quickActions.addWorker')}
            </Link>
          </div>
        </section>

        {attentionItems.length > 0 ? (
          <section className="card" aria-label={t('ux.attentionNeeded')}>
            <h2 className="section-heading">{t('ux.attentionNeeded')}</h2>
            <div className="attention-list">
              {attentionItems.map((item) => (
                <Link key={item.key} href={item.href} className="attention-item">
                  <span>{t(`dashboard.attention.${item.key}`)}</span>
                  <strong>{loading ? '…' : item.count}</strong>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {showNewJob ? (
          <section id="new-job" className="card dashboard-new-job-panel">
            <JobCreator
              onJobCreated={() => {
                setShowNewJob(false);
                void loadDashboard();
              }}
            />
          </section>
        ) : null}

        <section className="card dashboard-today-card" aria-label={t('dashboard.todaysSchedule')}>
          <div className="dashboard-section-head">
            <h2>{t('dashboard.todaysSchedule')}</h2>
            <Link href="/schedule" className="dashboard-section-link">
              {t('dashboard.viewSchedule')}
            </Link>
          </div>
          {loading ? <p className="loading-state" role="status">…</p> : null}
          {!loading && todayJobs.length === 0 ? (
            <p className="dashboard-quiet-empty">{t('dashboard.noScheduleToday')}</p>
          ) : null}
          {!loading &&
            todayJobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="dashboard-today-row">
                <span>{job.title}</span>
                <span className="muted">{job.due_date || job.start_date}</span>
              </Link>
            ))}
        </section>

        <div className="command-center-grid">
          <div className="command-center-sidebar">
            <section className="card">
              <h3 className="card-title-sm">{t('dashboard.sidebar.todayTasks')}</h3>
              <strong>{loading ? '…' : todayTasks}</strong>
              <Link href="/projects" className="dashboard-section-link">
                {t('dashboard.sidebar.viewTasks')}
              </Link>
            </section>
            <section className="card">
              <h3 className="card-title-sm">{t('dashboard.sidebar.notifications')}</h3>
              <strong>{loading ? '…' : unreadNotifications}</strong>
              <Link href="/notifications" className="dashboard-section-link">
                {t('dashboard.sidebar.openInbox')}
              </Link>
            </section>
            <section className="card">
              <h3 className="card-title-sm">{t('dashboard.sidebar.upcoming')}</h3>
              <strong>{loading ? '…' : dueInSevenDays}</strong>
              <Link href="/schedule" className="dashboard-section-link">
                {t('dashboard.sidebar.openSchedule')}
              </Link>
            </section>
            <section className="card">
              <h3 className="card-title-sm">{t('dashboard.sidebar.crmSnapshot')}</h3>
              <p className="muted">
                {loading
                  ? '…'
                  : t('dashboard.sidebar.leadsClients', { leads: leadCount, clients: clientCount })}
              </p>
              <Link href="/customers" className="dashboard-section-link">
                {t('dashboard.sidebar.openCrm')}
              </Link>
            </section>
          </div>
        </div>

        <details className="details-advanced">
          <summary>{t('ux.advancedTools')}</summary>
          <div className="details-advanced-body">
            {usageCounts ? (
              <details className="card dashboard-usage-card">
                <summary className="dashboard-section-head" style={{ cursor: 'pointer', listStyle: 'none' }}>
                  <h2 className="card-title-sm" style={{ margin: 0 }}>
                    {t('dashboard.moreDetails')}
                  </h2>
                </summary>
                <UsageDashboard plan={plan} counts={usageCounts} />
              </details>
            ) : null}

            {showActivity ? (
              <section className="card dashboard-metrics-card" aria-label={t('dashboard.recentActivity')}>
                <div className="dashboard-section-head">
                  <h2 className="card-title-sm">{t('dashboard.recentActivity')}</h2>
                  <Link href="/activity" className="dashboard-section-link">
                    {t('dashboard.viewActivity')}
                  </Link>
                </div>
                <ActivityFeed items={recentActivity} loading={loading} emptyLabel={t('dashboard.activityEmpty')} />
              </section>
            ) : null}

            <section className="card dashboard-quick-links-card" aria-label={t('dashboard.quickLinksLabel')}>
              <div className="btn-group-responsive">
                {QUICK_LINKS.map((link) => (
                  <Link key={link.key} href={quickLinkHref(link)} className="btn btn-sm">
                    {t(`dashboard.quickLinks.${link.key}`)}
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </details>
      </div>
    </AppShell>
  );
}
