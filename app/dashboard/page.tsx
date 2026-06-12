'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccessBlockedBanner } from '@/components/access-blocked-banner';
import { ActivityFeed } from '@/components/activity-feed';
import { AppShell } from '@/components/app-shell';
import { OnboardingChecklist } from '@/components/onboarding-checklist';
import { EmptyState } from '@/components/empty-state';
import { ExecutiveMetricsPanel } from '@/components/dashboard/executive-metrics';
import { UsageDashboard } from '@/components/usage-dashboard';
import { useTranslation } from '@/components/locale-provider';
import { mapAccessError } from '@/lib/auth-errors';
import { hasTeamManagement } from '@/lib/everittos-plans';
import { filterDemoSeedJobs } from '@/lib/demo-seed-filter';
import { fetchOrganizationContext } from '@/lib/organization';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
import { isClientRole, canManageOrganizationSettings, normalizeRole, type UserRole } from '@/lib/roles';
import { limitsForPlan } from '@/lib/everittos-limits';
import { EVERITTOS_STRIPE_LINKS, isPaidEverittosPlan, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchUsageCounts, type UsageCounts } from '@/lib/everittos-usage';
import { fetchPhotoCountsByJobIds } from '@/lib/job-photo-counts';
import { friendlyErrorMessage } from '@/lib/user-errors';
import { supabase } from '@/lib/supabase';

type Job = {
  id: string;
  title: string;
  customer_name: string | null;
  status: string | null;
  start_date: string | null;
  due_date: string | null;
  created_at: string | null;
  photo_count?: number;
};

function DashboardAccessNotice() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');
  const detail = searchParams.get('detail');
  if (!reason) return null;
  const mapped = mapAccessError(reason);
  return (
    <AccessBlockedBanner
      title={mapped.title}
      message={mapped.message}
      details={detail || mapped.details}
    />
  );
}

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
  const [activityCount, setActivityCount] = useState(0);
  const [activityItems, setActivityItems] = useState<
    { id: string; action: string; message: string | null; entity_type: string; created_at: string | null; actor_name: string | null }[]
  >([]);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);
  const [onboardingSkipped, setOnboardingSkipped] = useState(false);
  const [organizationId, setOrganizationId] = useState('');
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

    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const org = await fetchOrganizationContext(user.id);
    setRole(normalizeRole(profile?.role));
    if (org?.organizationId) {
      setOrganizationId(org.organizationId);
      const { data: settings } = await supabase
        .from('organization_settings')
        .select('onboarding_completed, onboarding_skipped, onboarding_step')
        .eq('organization_id', org.organizationId)
        .maybeSingle();
      setOnboardingCompleted(Boolean(settings?.onboarding_completed));
      setOnboardingSkipped(Boolean(settings?.onboarding_skipped));
      setOnboardingStep(settings?.onboarding_step || 0);
    } else {
      await fetch('/api/auth/setup', { method: 'POST' });
    }

    setPlan(normalizePlan(profile?.plan));

    const planNorm = normalizePlan(profile?.plan);
    let jobsQuery = supabase
      .from('jobs')
      .select('id, title, customer_name, status, start_date, due_date, created_at')
      .order('created_at', { ascending: false });
    if (org?.organizationId) {
      jobsQuery = jobsQuery.eq('organization_id', org.organizationId);
    } else {
      jobsQuery = jobsQuery.eq('user_id', user.id);
    }

    const [jobsRes, counts, activityRes, activityListRes, orgIsDemo] = await Promise.all([
      jobsQuery,
      fetchUsageCounts(user.id, org?.organizationId),
      org?.organizationId
        ? supabase
            .from('activity_logs')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', org.organizationId)
        : Promise.resolve({ count: 0 }),
      org?.organizationId && limitsForPlan(planNorm).activityLog
        ? supabase
            .from('activity_logs')
            .select('id, action, message, entity_type, created_at, actor_name')
            .eq('organization_id', org.organizationId)
            .order('created_at', { ascending: false })
            .limit(6)
        : Promise.resolve({ data: [] }),
      fetchOrganizationIsDemo(supabase, org?.organizationId)
    ]);

    setLoading(false);

    if (jobsRes.error) {
      setErrorMessage(jobsRes.error.message);
      return;
    }

    const jobRows = filterDemoSeedJobs(jobsRes.data || [], orgIsDemo);
    const photoCounts = await fetchPhotoCountsByJobIds(jobRows.map((j) => j.id));
    setJobs(jobRows.map((j) => ({ ...j, photo_count: photoCounts[j.id] || 0 })));
    setUsage(counts);
    setActivityCount(activityRes.count || 0);
    setActivityItems(activityListRes.data || []);

    if (isClientRole(normalizeRole(profile?.role))) {
      router.push('/portal/client');
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const upcoming = useMemo(() => {
    return jobs
      .filter((j) => j.due_date && j.status !== 'completed' && j.status !== 'cancelled')
      .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
      .slice(0, 4);
  }, [jobs]);

  const openJobs = useMemo(
    () => jobs.filter((j) => j.status !== 'completed' && j.status !== 'cancelled').length,
    [jobs]
  );

  const dueSoon = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const weekAhead = new Date();
    weekAhead.setDate(weekAhead.getDate() + 7);
    const end = weekAhead.toISOString().slice(0, 10);
    return jobs.filter(
      (j) => j.due_date && j.due_date >= today && j.due_date <= end && j.status !== 'completed' && j.status !== 'cancelled'
    ).length;
  }, [jobs]);

  const showExecutiveMetrics = canManageOrganizationSettings(role) && (jobs.length > 0 || activityCount > 0);
  const teamHref = hasTeamManagement(plan) ? '/team' : '/settings/billing?upgrade=business';

  return (
    <AppShell plan={plan} role={role}>
      <Suspense>
        <DashboardAccessNotice />
      </Suspense>

      <div className="page-head dashboard-page-head">
        <div>
          <h1>{t('dashboard.title')}</h1>
          <p className="page-subtitle">{t('dashboard.subtitle')}</p>
        </div>
        <Link href="/jobs" className="btn btn-primary dashboard-primary-cta">
          {t('dashboard.createJob')}
        </Link>
      </div>

      <section className="dashboard-glance" aria-label="Operations summary">
        <div className="dashboard-glance-card">
          <span>{t('dashboard.openJobs')}</span>
          <strong>{loading ? '…' : openJobs}</strong>
        </div>
        <div className="dashboard-glance-card">
          <span>{t('dashboard.completedJobs')}</span>
          <strong>{loading ? '…' : jobs.filter((j) => j.status === 'completed').length}</strong>
        </div>
        <div className="dashboard-glance-card">
          <span>{t('dashboard.dueSoon')}</span>
          <strong>{loading ? '…' : dueSoon}</strong>
        </div>
        <div className="dashboard-glance-card">
          <span>{t('dashboard.reportsOnFile')}</span>
          <strong>{loading ? '…' : usage.reports}</strong>
        </div>
        <div className="dashboard-glance-card">
          <span>{t('dashboard.teamMembers')}</span>
          <strong>{loading ? '…' : usage.teamMembers}</strong>
        </div>
      </section>

      <section className="card dashboard-quick-links-card" aria-label={t('dashboard.quickLinks')}>
        <h3 className="card-title-sm">{t('dashboard.quickLinks')}</h3>
        <div className="dashboard-quick-links-row">
          <Link href={teamHref} className="btn">
            {t('dashboard.inviteTeam')}
          </Link>
          <Link href="/jobs" className="btn">
            {t('dashboard.viewReports')}
          </Link>
          <Link href="/schedule" className="btn">
            {t('dashboard.upcomingWork')}
          </Link>
        </div>
      </section>

      {!isPaidEverittosPlan(plan) && (
        <div className="dashboard-upgrade-strip">
          <p>
            <strong>{t('dashboard.upgradeTitle')}</strong> {t('dashboard.upgradeBody')}
          </p>
          <Link href="/settings/billing" className="btn btn-sm">
            View plans
          </Link>
        </div>
      )}

      {organizationId ? (
        <OnboardingChecklist
          organizationId={organizationId}
          step={onboardingStep}
          completed={onboardingCompleted}
          skipped={onboardingSkipped}
        />
      ) : null}

      <div className="card dashboard-usage-card">
        <UsageDashboard plan={plan} counts={usage} />
      </div>

      {showExecutiveMetrics ? (
        <div className="card dashboard-metrics-card">
          <ExecutiveMetricsPanel />
        </div>
      ) : null}

      {limitsForPlan(plan).activityLog && activityItems.length > 0 && (
        <div className="card">
          <h3 className="card-title-sm">{t('dashboard.recentActivity')}</h3>
          <ActivityFeed items={activityItems} />
          <Link href="/activity" className="btn btn-sm" style={{ marginTop: 12 }}>
            {t('dashboard.viewAllActivity')}
          </Link>
        </div>
      )}

      <div className="dashboard-jobs-grid">
        <div className="card">
          <h3 className="card-title-sm">{t('dashboard.upcomingJobs')}</h3>
          {loading ? <p className="loading-state" role="status">Loading…</p> : null}
          {!loading && upcoming.length === 0 ? (
            <EmptyState
              title="No upcoming due dates"
              description="Add due dates on job details to see scheduled work here."
              action={
                <Link className="btn btn-sm" href="/schedule">
                  Open schedule
                </Link>
              }
            />
          ) : null}
          {!loading &&
            upcoming.map((job) => (
              <div key={job.id} className="dashboard-job-row">
                <div>
                  <strong>{job.title}</strong>
                  <p className="muted">Due {job.due_date}</p>
                </div>
                <Link className="btn btn-sm" href={`/jobs/${job.id}`}>
                  Open
                </Link>
              </div>
            ))}
        </div>

        <div className="card">
          <h3 className="card-title-sm">{t('dashboard.recentJobs')}</h3>
          {loading ? <p className="loading-state" role="status">Loading…</p> : null}
          {errorMessage ? (
            <p className="auth-message auth-message-error" role="alert">
              {friendlyErrorMessage(errorMessage)}
            </p>
          ) : null}
          {!loading && !errorMessage && jobs.length === 0 ? (
            <EmptyState title={t('empty.jobs.title')} description={t('empty.jobs.description')} action={<Link className="btn btn-primary btn-sm" href="/jobs">{t('empty.jobs.action')}</Link>} />
          ) : null}
          {!loading &&
            !errorMessage &&
            jobs.slice(0, 5).map((job) => (
              <div key={job.id} className="dashboard-job-row">
                <div>
                  <strong>{job.title}</strong>
                  <p className="muted">
                    {job.customer_name || 'No customer'} · {job.status || 'new'}
                    {job.photo_count ? ` · ${job.photo_count} photo${job.photo_count === 1 ? '' : 's'}` : ''}
                  </p>
                </div>
                <Link className="btn btn-sm btn-primary" href={`/jobs/${job.id}`}>
                  Open
                </Link>
              </div>
            ))}
        </div>
      </div>
    </AppShell>
  );
}
