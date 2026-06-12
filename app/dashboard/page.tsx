'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccessBlockedBanner } from '@/components/access-blocked-banner';
import { ActivityFeed } from '@/components/activity-feed';
import { AppShell } from '@/components/app-shell';
import { OnboardingSkippedPrompts } from '@/components/dashboard/onboarding-skipped-prompts';
import { EmptyState } from '@/components/empty-state';
import { JobCreator } from '@/components/job-creator';
import { UsageDashboard } from '@/components/usage-dashboard';
import { useTranslation } from '@/components/locale-provider';
import { mapAccessError } from '@/lib/auth-errors';
import { hasTeamManagement } from '@/lib/everittos-plans';
import { filterDemoSeedJobs } from '@/lib/demo-seed-filter';
import { fetchOrganizationContext } from '@/lib/organization';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
import { isClientRole, normalizeRole, type UserRole } from '@/lib/roles';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchUsageCounts, type UsageCounts } from '@/lib/everittos-usage';
import { friendlyErrorMessage } from '@/lib/user-errors';
import { supabase } from '@/lib/supabase';

type Job = {
  id: string;
  title: string;
  customer_name: string | null;
  status: string | null;
  start_date: string | null;
  due_date: string | null;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
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

const PRIMARY_ACTIONS = [
  { key: 'newJob', href: '#new-job', primary: true },
  { key: 'schedule', href: '/schedule' },
  { key: 'customers', href: '/customers' },
  { key: 'workers', href: '/workers' },
  { key: 'billing', href: '/settings/billing' }
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [usage, setUsage] = useState<UsageCounts>({
    jobs: 0,
    photos: 0,
    customers: 0,
    reports: 0,
    workers: 0,
    teamMembers: 1,
    locations: 0
  });
  const [role, setRole] = useState<UserRole>('owner');
  const [displayName, setDisplayName] = useState('');
  const [activityItems, setActivityItems] = useState<
    { id: string; action: string; message: string | null; entity_type: string; created_at: string | null; actor_name: string | null }[]
  >([]);
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);
  const [onboardingSkipped, setOnboardingSkipped] = useState(false);
  const [organizationId, setOrganizationId] = useState('');
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarConfigured, setCalendarConfigured] = useState(false);
  const [unpaidInvoices, setUnpaidInvoices] = useState(0);
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
    setRole(normalizeRole(profile?.role));
    setDisplayName(profile?.full_name?.trim() || profile?.business_name?.trim() || '');

    if (org?.organizationId) {
      setOrganizationId(org.organizationId);
      const { data: settings } = await supabase
        .from('organization_settings')
        .select('onboarding_completed, onboarding_skipped')
        .eq('organization_id', org.organizationId)
        .maybeSingle();
      setOnboardingCompleted(Boolean(settings?.onboarding_completed));
      setOnboardingSkipped(Boolean(settings?.onboarding_skipped));
    } else {
      await fetch('/api/auth/setup', { method: 'POST' });
    }

    setPlan(normalizePlan(profile?.plan));
    const planNorm = normalizePlan(profile?.plan);

    let jobsQuery = supabase
      .from('jobs')
      .select('id, title, customer_name, status, start_date, due_date')
      .order('created_at', { ascending: false });
    if (org?.organizationId) {
      jobsQuery = jobsQuery.eq('organization_id', org.organizationId);
    } else {
      jobsQuery = jobsQuery.eq('user_id', user.id);
    }

    const invoiceQuery = org?.organizationId
      ? supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.organizationId)
          .neq('status', 'paid')
          .neq('status', 'cancelled')
      : Promise.resolve({ count: 0, error: null });

    const [jobsRes, counts, activityListRes, orgIsDemo, invoiceRes] = await Promise.all([
      jobsQuery,
      fetchUsageCounts(user.id, org?.organizationId),
      org?.organizationId && limitsForPlan(planNorm).activityLog
        ? supabase
            .from('activity_logs')
            .select('id, action, message, entity_type, created_at, actor_name')
            .eq('organization_id', org.organizationId)
            .order('created_at', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] }),
      fetchOrganizationIsDemo(supabase, org?.organizationId),
      invoiceQuery
    ]);

    setLoading(false);

    if (jobsRes.error) {
      setErrorMessage(jobsRes.error.message);
      return;
    }

    setJobs(filterDemoSeedJobs(jobsRes.data || [], orgIsDemo));
    setUsage(counts);
    setActivityItems(activityListRes.data || []);
    if (!invoiceRes.error) {
      setUnpaidInvoices(invoiceRes.count || 0);
    }

    try {
      const calendarRes = await fetch('/api/integrations/google-calendar/status');
      if (calendarRes.ok) {
        const calendarJson = (await calendarRes.json()) as { connected?: boolean; configured?: boolean };
        setCalendarConnected(Boolean(calendarJson.connected));
        setCalendarConfigured(Boolean(calendarJson.configured));
      }
    } catch {
      /* optional */
    }

    if (isClientRole(normalizeRole(profile?.role))) {
      router.push('/portal/client');
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const today = todayIso();

  const openJobs = useMemo(
    () => jobs.filter((j) => j.status !== 'completed' && j.status !== 'cancelled').length,
    [jobs]
  );

  const jobsToday = useMemo(
    () =>
      jobs.filter(
        (j) =>
          j.status !== 'cancelled' &&
          (j.start_date === today || j.due_date === today)
      ).length,
    [jobs, today]
  );

  const upcomingSchedule = useMemo(() => {
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
        .filter(
          (j) =>
            j.status !== 'cancelled' &&
            (j.start_date === today || j.due_date === today)
        )
        .slice(0, 4),
    [jobs, today]
  );

  const showSetupBanner = organizationId && !onboardingCompleted && !onboardingSkipped;

  return (
    <AppShell plan={plan} role={role} showBackButton={false}>
      <Suspense>
        <DashboardAccessNotice />
      </Suspense>

      <header className="dashboard-hero">
        <div>
          <h1 className="dashboard-hero-title">
            {displayName ? t('dashboard.welcomeName', { name: displayName }) : t('dashboard.welcome')}
          </h1>
        </div>
        <button type="button" className="btn btn-primary dashboard-hero-cta" onClick={() => setShowNewJob((v) => !v)}>
          {t('dashboard.newJob')}
        </button>
      </header>

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

      <nav className="dashboard-actions" aria-label={t('dashboard.primaryActions')}>
        {PRIMARY_ACTIONS.map((action) =>
          action.key === 'newJob' ? (
            <button
              key={action.key}
              type="button"
              className="dashboard-action-tile dashboard-action-tile-primary"
              onClick={() => setShowNewJob(true)}
            >
              {t(`dashboard.actions.${action.key}`)}
            </button>
          ) : (
            <Link key={action.key} href={action.href} className="dashboard-action-tile">
              {t(`dashboard.actions.${action.key}`)}
            </Link>
          )
        )}
      </nav>

      <section className="dashboard-metrics" aria-label={t('dashboard.metricsLabel')}>
        <div className="dashboard-metric-card">
          <span>{t('dashboard.metrics.jobsToday')}</span>
          <strong>{loading ? '…' : jobsToday}</strong>
        </div>
        <div className="dashboard-metric-card">
          <span>{t('dashboard.metrics.openJobs')}</span>
          <strong>{loading ? '…' : openJobs}</strong>
        </div>
        <div className="dashboard-metric-card">
          <span>{t('dashboard.metrics.unpaidInvoices')}</span>
          <strong>{loading ? '…' : unpaidInvoices}</strong>
        </div>
        <div className="dashboard-metric-card">
          <span>{t('dashboard.metrics.upcomingSchedule')}</span>
          <strong>{loading ? '…' : upcomingSchedule}</strong>
        </div>
      </section>

      {showSetupBanner ? (
        <p className="dashboard-setup-banner">
          <Link href="/onboarding">{t('dashboard.finishSetup')}</Link>
        </p>
      ) : null}

      <OnboardingSkippedPrompts
        skipped={onboardingSkipped}
        jobsCount={usage.jobs}
        customersCount={usage.customers}
        teamMembers={usage.teamMembers}
        calendarConnected={calendarConnected}
        calendarConfigured={calendarConfigured}
        teamManagementEnabled={hasTeamManagement(plan)}
      />

      <section className="card dashboard-activity-card">
        <div className="dashboard-section-head">
          <h2>{t('dashboard.recentActivity')}</h2>
          {activityItems.length > 0 ? (
            <Link href="/activity" className="dashboard-section-link">
              {t('dashboard.viewActivity')}
            </Link>
          ) : null}
        </div>
        {errorMessage ? (
          <p className="auth-message auth-message-error" role="alert">
            {friendlyErrorMessage(errorMessage)}
          </p>
        ) : null}
        {!loading && activityItems.length === 0 ? (
          <EmptyState
            compact
            title={t('empty.activity.title')}
            action={
              <Link href="/jobs" className="btn btn-sm">
                {t('dashboard.newJob')}
              </Link>
            }
          />
        ) : (
          <ActivityFeed items={activityItems} />
        )}
      </section>

      <details className="dashboard-more">
        <summary>{t('dashboard.moreDetails')}</summary>
        <div className="dashboard-more-body">
          <UsageDashboard plan={plan} counts={usage} />
        </div>
      </details>
    </AppShell>
  );
}
