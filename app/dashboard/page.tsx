'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccessBlockedBanner } from '@/components/access-blocked-banner';
import { AppShell } from '@/components/app-shell';
import { JobCreator } from '@/components/job-creator';
import { useTranslation } from '@/components/locale-provider';
import { mapAccessError } from '@/lib/auth-errors';
import { filterDemoSeedJobs } from '@/lib/demo-seed-filter';
import { fetchOrganizationContext } from '@/lib/organization';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
import { isClientRole, normalizeRole, type UserRole } from '@/lib/roles';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
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
  const [role, setRole] = useState<UserRole>('owner');
  const [displayName, setDisplayName] = useState('');
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

    if (!org) {
      await fetch('/api/auth/setup', { method: 'POST' });
    }

    setPlan(normalizePlan(profile?.plan));

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

    const [jobsRes, orgIsDemo, invoiceRes] = await Promise.all([
      jobsQuery,
      fetchOrganizationIsDemo(supabase, org?.organizationId),
      invoiceQuery
    ]);

    setLoading(false);

    if (jobsRes.error) {
      setErrorMessage(jobsRes.error.message);
      return;
    }

    setJobs(filterDemoSeedJobs(jobsRes.data || [], orgIsDemo));
    if (!invoiceRes.error) {
      setUnpaidInvoices(invoiceRes.count || 0);
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
        (j) => j.status !== 'cancelled' && (j.start_date === today || j.due_date === today)
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
          (j) => j.status !== 'cancelled' && (j.start_date === today || j.due_date === today)
        )
        .slice(0, 4),
    [jobs, today]
  );

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
    </AppShell>
  );
}
