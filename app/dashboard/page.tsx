'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccessBlockedBanner } from '@/components/access-blocked-banner';
import { ActivityFeed } from '@/components/activity-feed';
import { RoleDashboard } from '@/components/role-dashboard';
import { AppShell } from '@/components/app-shell';
import { EmptyState } from '@/components/empty-state';
import { friendlyErrorMessage } from '@/lib/user-errors';
import { UsageDashboard } from '@/components/usage-dashboard';
import { JobCreator } from '@/components/job-creator';
import { mapAccessError } from '@/lib/auth-errors';
import { fetchOrganizationContext } from '@/lib/organization';
import { isClientRole, normalizeRole, type UserRole } from '@/lib/roles';
import { limitsForPlan } from '@/lib/everittos-limits';
import { EVERITTOS_STRIPE_LINKS, isPaidEverittosPlan, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchUsageCounts, type UsageCounts } from '@/lib/everittos-usage';
import { supabase } from '@/lib/supabase';

type Job = {
  id: string;
  title: string;
  customer_name: string | null;
  status: string | null;
  start_date: string | null;
  due_date: string | null;
  created_at: string | null;
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
  const [onboardingPct, setOnboardingPct] = useState(100);
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
      const { data: settings } = await supabase
        .from('organization_settings')
        .select('onboarding_completed, onboarding_step')
        .eq('organization_id', org.organizationId)
        .maybeSingle();
      if (settings && !settings.onboarding_completed) {
        router.push('/onboarding');
        return;
      }
      setOnboardingPct(settings?.onboarding_completed ? 100 : Math.round(((settings?.onboarding_step || 0) / 6) * 100));
    }

    setPlan(normalizePlan(profile?.plan));

    const planNorm = normalizePlan(profile?.plan);
    const [jobsRes, counts, activityRes, activityListRes] = await Promise.all([
      supabase
        .from('jobs')
        .select('id, title, customer_name, status, start_date, due_date, created_at')
        .order('created_at', { ascending: false }),
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
            .limit(8)
        : Promise.resolve({ data: [] })
    ]);

    setLoading(false);

    if (jobsRes.error) {
      setErrorMessage(jobsRes.error.message);
      return;
    }

    setJobs(jobsRes.data || []);
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
      .slice(0, 5);
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

  return (
    <AppShell plan={plan} role={role}>
        <Suspense>
          <DashboardAccessNotice />
        </Suspense>
        <div className="page-head">
          <div>
            <h1>Dashboard</h1>
            <p>What needs attention right now.</p>
          </div>
        </div>

        <section className="dashboard-quick-actions" aria-label="Quick actions" style={{ marginTop: 18 }}>
          <h2 className="sr-only">Quick actions</h2>
          <div className="dashboard-quick-actions-grid">
            <Link href="/jobs" className="btn btn-primary">
              Create job
            </Link>
            <Link href="/team" className="btn">
              Invite team member
            </Link>
            <Link href="/jobs" className="btn">
              View reports
            </Link>
            <Link href="/schedule" className="btn">
              Upcoming work
            </Link>
          </div>
        </section>

        <section className="dashboard-glance" aria-label="Operations summary">
          <div className="dashboard-glance-card">
            <span>Open jobs</span>
            <strong>{loading ? '—' : openJobs}</strong>
          </div>
          <div className="dashboard-glance-card">
            <span>Completed jobs</span>
            <strong>{loading ? '—' : jobs.filter((j) => j.status === 'completed').length}</strong>
          </div>
          <div className="dashboard-glance-card">
            <span>Due in 7 days</span>
            <strong>{loading ? '—' : dueSoon}</strong>
          </div>
          <div className="dashboard-glance-card">
            <span>Reports on file</span>
            <strong>{loading ? '—' : usage.reports}</strong>
          </div>
          <div className="dashboard-glance-card">
            <span>Team members</span>
            <strong>{loading ? '—' : usage.teamMembers}</strong>
          </div>
        </section>

        {!isPaidEverittosPlan(plan) && (
          <div className="card upgrade-banner">
            <div>
              <h3>Upgrade when you need more capacity</h3>
              <p>Pro adds photos and higher limits. Business adds team management and crew assignment.</p>
            </div>
            <div className="upgrade-banner-actions">
              <a href={EVERITTOS_STRIPE_LINKS.pro} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                Start Pro
              </a>
              <a href={EVERITTOS_STRIPE_LINKS.business} target="_blank" rel="noopener noreferrer" className="btn">
                Start Business
              </a>
            </div>
          </div>
        )}

        {onboardingPct < 100 && (
          <div className="card" style={{ marginTop: 18 }}>
            <h3>Onboarding progress</h3>
            <div className="onboarding-progress">
              <div className="onboarding-progress-bar" style={{ width: `${onboardingPct}%` }} />
            </div>
            <Link href="/onboarding" className="btn btn-primary" style={{ marginTop: 12 }}>
              Continue setup
            </Link>
          </div>
        )}

        <div className="card" style={{ marginTop: 18 }}>
          <UsageDashboard plan={plan} counts={usage} />
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <RoleDashboard
            role={role}
            jobs={jobs}
            photoCount={usage.photos}
            reportCount={usage.reports}
            activityCount={activityCount}
            customerCount={usage.customers}
            teamCount={usage.teamMembers}
          />
        </div>

        {limitsForPlan(plan).activityLog && activityItems.length > 0 && (
          <div className="card" style={{ marginTop: 18 }}>
            <h3>Recent activity</h3>
            <ActivityFeed items={activityItems} />
            <Link href="/activity" className="btn" style={{ marginTop: 12 }}>
              View all activity
            </Link>
          </div>
        )}

        <div className="grid-2" style={{ marginTop: 18 }}>
          <JobCreator onJobCreated={loadDashboard} />

          <div className="workflow">
            <div className="card">
              <h3>Upcoming jobs</h3>
              {loading ? <p className="loading-state" role="status">Loading upcoming jobs…</p> : null}
              {!loading && upcoming.length === 0 ? (
                <EmptyState
                  title="No upcoming due dates"
                  description="Add due dates on job details to see scheduled work here."
                  action={
                    <Link className="btn" href="/schedule">
                      Open schedule
                    </Link>
                  }
                />
              ) : null}
              {!loading &&
                upcoming.map((job) => (
                  <div key={job.id} className="card" style={{ marginTop: 12 }}>
                    <h3>{job.title}</h3>
                    <p>Due: {job.due_date}</p>
                    <Link className="btn" href={`/jobs/${job.id}`}>
                      Open
                    </Link>
                  </div>
                ))}
              <Link className="btn" href="/schedule" style={{ marginTop: 12 }}>
                View schedule
              </Link>
            </div>

            <div className="card" style={{ marginTop: 18 }}>
              <h3>Recent jobs</h3>
              {loading ? <p className="loading-state" role="status">Loading jobs…</p> : null}
              {errorMessage ? (
                <p className="auth-message auth-message-error" role="alert">
                  {friendlyErrorMessage(errorMessage)}
                </p>
              ) : null}
              {!loading && !errorMessage && jobs.length === 0 ? (
                <EmptyState
                  title="No jobs yet"
                  description="Create your first job to start tracking field work."
                />
              ) : null}
              {!loading &&
                !errorMessage &&
                jobs.slice(0, 5).map((job) => (
                  <div key={job.id} className="card" style={{ marginTop: 12 }}>
                    <h3>{job.title}</h3>
                    <p>Customer: {job.customer_name || 'Not set'}</p>
                    <p>Status: {job.status || 'new'}</p>
                    <Link className="btn btn-primary" href={`/jobs/${job.id}`}>
                      Open job
                    </Link>
                  </div>
                ))}
            </div>
          </div>
        </div>
    </AppShell>
  );
}
