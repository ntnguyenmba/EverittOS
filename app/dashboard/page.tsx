'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccessBlockedBanner } from '@/components/access-blocked-banner';
import { AppShell } from '@/components/app-shell';
import { JobCreator } from '@/components/job-creator';
import { useTranslation } from '@/components/locale-provider';
import { PageHeader } from '@/components/page-header';
import { todayIso } from '@/lib/date-filters';
import { mapAccessError } from '@/lib/auth-errors';
import { filterDemoSeedJobs } from '@/lib/demo-seed-filter';
import { limitsForPlan } from '@/lib/everittos-limits';
import { billingUpgradeHref } from '@/lib/nav-access';
import { fetchOrganizationContext } from '@/lib/organization';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isClientRole, normalizeRole, type UserRole } from '@/lib/roles';
import { friendlyErrorMessage } from '@/lib/user-errors';
import { supabase } from '@/lib/supabase';

type Job = {
  id: string;
  title: string;
  status: string | null;
  start_date: string | null;
  due_date: string | null;
};

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

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [displayName, setDisplayName] = useState('');
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
      .select('id, title, status, start_date, due_date')
      .order('created_at', { ascending: false });
    if (org?.organizationId) {
      jobsQuery = jobsQuery.eq('organization_id', org.organizationId);
    } else {
      jobsQuery = jobsQuery.eq('user_id', user.id);
    }

    const [jobsRes, orgIsDemo] = await Promise.all([jobsQuery, fetchOrganizationIsDemo(supabase, org?.organizationId)]);

    setLoading(false);

    if (jobsRes.error) {
      setErrorMessage(jobsRes.error.message);
      return;
    }

    setJobs(filterDemoSeedJobs(jobsRes.data || [], orgIsDemo));

    if (isClientRole(normalizeRole(profile?.role))) {
      router.push('/portal/client');
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const today = todayIso();

  const todayJobs = useMemo(
    () =>
      jobs
        .filter((j) => j.status !== 'cancelled' && (j.start_date === today || j.due_date === today))
        .slice(0, 8),
    [jobs, today]
  );

  function workersHref(): string {
    if (!limitsForPlan(plan).crewAssignment) {
      return billingUpgradeHref('business', t('dashboard.actions.workers'));
    }
    return '/workers';
  }

  const welcomeSubtitle = displayName
    ? t('dashboard.welcomeName', { name: displayName })
    : t('dashboard.subtitle');

  const coreActions = [
    { key: 'newJob', href: null, onClick: () => setShowNewJob(true), primary: true },
    { key: 'schedule', href: '/schedule', onClick: null, primary: false },
    { key: 'customers', href: '/customers', onClick: null, primary: false },
    { key: 'workers', href: workersHref(), onClick: null, primary: false },
    { key: 'billing', href: '/settings/billing', onClick: null, primary: false }
  ] as const;

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

        <section aria-label={t('dashboard.primaryActions')}>
          <h2 className="section-heading">{t('dashboard.primaryActions')}</h2>
          <div className="quick-actions-grid">
            {coreActions.map((action) => {
              const label = t(`dashboard.actions.${action.key}`);
              if (action.onClick) {
                return (
                  <button
                    key={action.key}
                    type="button"
                    className={action.primary ? 'quick-action-tile quick-action-tile-primary' : 'quick-action-tile'}
                    onClick={action.onClick}
                  >
                    {label}
                  </button>
                );
              }
              return (
                <Link
                  key={action.key}
                  href={action.href || '/dashboard'}
                  className={action.primary ? 'quick-action-tile quick-action-tile-primary' : 'quick-action-tile'}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </section>

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
          {loading ? <p className="loading-state" role="status">{t('common.loading')}</p> : null}
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
      </div>
    </AppShell>
  );
}
