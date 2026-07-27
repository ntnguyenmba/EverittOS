'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';
import { canAccessNavHref } from '@/lib/nav-access';
import { normalizePlan } from '@/lib/everittos-plans';
import { isAdminRole, isClientRole, isContractorRole, isStaffRole, type UserRole } from '@/lib/roles';

type JobRow = {
  id: string;
  title: string;
  status: string | null;
  due_date: string | null;
  start_date: string | null;
  assigned_to?: string | null;
  customer_name?: string | null;
  phone?: string | null;
  address?: string | null;
};

type TeamMemberSummary = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  active: boolean;
  activeJobs: number;
  dueToday: number;
  overdue: number;
  completed: number;
  lastActivity: string | null;
};

type ActivitySummary = {
  id: string;
  message: string;
  actorName: string | null;
  createdAt: string | null;
};

type RoleDashboardProps = {
  role: UserRole;
  jobs: JobRow[];
  photoCount: number;
  reportCount: number;
  activityCount: number;
  customerCount?: number;
  teamCount?: number;
  teamMembers?: TeamMemberSummary[];
  recentActivity?: ActivitySummary[];
  plan?: string | null;
};

function FieldWorkerDashboard({
  jobs,
  photoCount,
  t
}: {
  jobs: JobRow[];
  photoCount: number;
  t: (path: string, values?: Record<string, string | number>) => string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const active = jobs.filter((j) => j.status !== 'completed' && j.status !== 'cancelled');
  const todayJobs = active.filter((j) => (j.start_date || j.due_date || '').slice(0, 10) === today);
  const nextJobs = active
    .filter((j) => !todayJobs.some((todayJob) => todayJob.id === j.id))
    .sort((a, b) => (a.start_date || a.due_date || '').localeCompare(b.start_date || b.due_date || ''))
    .slice(0, 6);
  const completed = jobs.filter((j) => j.status === 'completed');
  const primaryJob = todayJobs[0] || active[0] || null;

  const displayDate = (value: string | null | undefined) => {
    if (!value) return t('dashboard.role.field.notScheduled');
    return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="role-dashboard field-dashboard">
      <div className="dashboard-section-head">
        <div>
          <h3>{t('dashboard.role.field.title')}</h3>
          <p className="muted">{t('dashboard.role.field.intro')}</p>
        </div>
        <Link href="/schedule" className="dashboard-section-link">
          {t('dashboard.role.openSchedule')}
        </Link>
      </div>

      <div className="stats-grid">
        <Link href="/jobs?mine=true" className="stat-card" style={{ textDecoration: 'none' }}>
          <span>{t('dashboard.role.field.myActiveJobs')}</span>
          <strong>{active.length}</strong>
        </Link>
        <Link href="/schedule" className="stat-card" style={{ textDecoration: 'none' }}>
          <span>{t('dashboard.role.field.dueToday')}</span>
          <strong>{todayJobs.length}</strong>
        </Link>
        <Link href="/jobs?status=completed&mine=true" className="stat-card" style={{ textDecoration: 'none' }}>
          <span>{t('dashboard.role.field.completed')}</span>
          <strong>{completed.length}</strong>
        </Link>
        <Link href="/photos" className="stat-card" style={{ textDecoration: 'none' }}>
          <span>{t('dashboard.role.field.photosUploaded')}</span>
          <strong>{photoCount}</strong>
        </Link>
      </div>

      {primaryJob ? (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="dashboard-section-head">
            <div>
              <h4>{t('dashboard.role.field.currentJob')}</h4>
              <p className="muted">{t('dashboard.role.field.currentJobHint')}</p>
            </div>
            <Link href={`/jobs/${primaryJob.id}`} className="btn btn-primary">
              {t('dashboard.role.field.openJob')}
            </Link>
          </div>
          <div className="list-row">
            <div>
              <strong>{primaryJob.title}</strong>
              <p className="muted">{primaryJob.address || primaryJob.customer_name || t('dashboard.role.field.noCustomerDetails')}</p>
            </div>
            <span>{displayDate(primaryJob.start_date || primaryJob.due_date)}</span>
          </div>
          <div className="button-row" style={{ marginTop: 12 }}>
            <Link href={`/jobs/${primaryJob.id}`} className="btn btn-primary">
              {t('dashboard.role.field.startOrFinish')}
            </Link>
            {primaryJob.phone ? (
              <a href={`tel:${primaryJob.phone}`} className="btn">
                {t('dashboard.role.field.callCustomer')}
              </a>
            ) : null}
            {primaryJob.address ? (
              <a href={`https://maps.google.com/?q=${encodeURIComponent(primaryJob.address)}`} className="btn" target="_blank" rel="noreferrer">
                {t('dashboard.role.field.startNavigation')}
              </a>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="card" style={{ marginTop: 16 }}>
          <h4>{t('dashboard.role.field.noAssignedWork')}</h4>
          <p className="muted">{t('dashboard.role.field.noAssignedWorkHint')}</p>
        </section>
      )}

      <section className="card role-dashboard-upcoming" style={{ marginTop: 16 }}>
        <div className="dashboard-section-head">
          <h4>{t('dashboard.role.field.myJobsToday')}</h4>
          <Link href="/jobs?mine=true" className="dashboard-section-link">
            {t('dashboard.role.field.viewAll')}
          </Link>
        </div>
        {todayJobs.length === 0 && <p className="muted">{t('dashboard.role.field.noJobsToday')}</p>}
        {todayJobs.map((job) => (
          <div key={job.id} className="list-row">
            <div>
              <Link href={`/jobs/${job.id}`}>{job.title}</Link>
              <p className="muted">{job.address || job.customer_name || t('dashboard.role.field.noLocation')}</p>
            </div>
            <span>{job.status || 'new'}</span>
          </div>
        ))}
      </section>

      <section className="card role-dashboard-upcoming" style={{ marginTop: 16 }}>
        <div className="dashboard-section-head">
          <h4>{t('dashboard.role.field.nextAssignedJobs')}</h4>
          <Link href="/schedule" className="dashboard-section-link">
            {t('dashboard.role.openSchedule')}
          </Link>
        </div>
        {nextJobs.length === 0 && <p className="muted">{t('dashboard.role.field.noUpcomingAssigned')}</p>}
        {nextJobs.map((job) => (
          <div key={job.id} className="list-row">
            <div>
              <Link href={`/jobs/${job.id}`}>{job.title}</Link>
              <p className="muted">{job.address || job.customer_name || t('dashboard.role.field.noLocation')}</p>
            </div>
            <span>{displayDate(job.start_date || job.due_date)}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

export function RoleDashboard({
  role,
  jobs,
  photoCount,
  reportCount,
  activityCount,
  customerCount = 0,
  teamCount = 0,
  teamMembers = [],
  recentActivity = [],
  plan
}: RoleDashboardProps) {
  const { t } = useTranslation();
  const normalizedPlan = normalizePlan(plan);

  if (isStaffRole(role)) {
    return <FieldWorkerDashboard jobs={jobs} photoCount={photoCount} t={t} />;
  }

  const canLink = (href: string) => canAccessNavHref(role, href.split('?')[0], normalizedPlan);

  const today = new Date().toISOString().slice(0, 10);
  const active = jobs.filter((j) => j.status !== 'completed' && j.status !== 'cancelled');
  const completed = jobs.filter((j) => j.status === 'completed');
  const overdue = active.filter((j) => j.due_date && j.due_date < today);
  const upcoming = active
    .filter((j) => j.due_date)
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
    .slice(0, 8);

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartIso = monthStart.toISOString().slice(0, 10);
  const createdThisMonth = jobs.filter((j) => j.start_date && j.start_date >= monthStartIso).length;
  const canViewTeamCommandCenter = isAdminRole(role);

  const formatDate = (value: string | null | undefined) => {
    if (!value) return t('dashboard.role.field.noActivityYet');
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const workloadLabel = (member: TeamMemberSummary) => {
    if (!member.active) return t('dashboard.role.workload.inactive');
    if (member.overdue > 0 || member.activeJobs >= 8) return t('dashboard.role.workload.overloaded');
    if (member.activeJobs >= 4 || member.dueToday > 0) return t('dashboard.role.workload.busy');
    return t('dashboard.role.workload.available');
  };

  const cards = [
    {
      label: canViewTeamCommandCenter ? t('dashboard.role.metrics.teamActiveJobs') : t('dashboard.role.metrics.activeJobs'),
      value: active.length,
      href: '/jobs?status=active'
    },
    {
      label: canViewTeamCommandCenter ? t('dashboard.role.metrics.teamCompletedJobs') : t('dashboard.role.metrics.completed'),
      value: completed.length,
      href: '/jobs?status=completed'
    },
    {
      label: canViewTeamCommandCenter ? t('dashboard.role.metrics.teamOverdueJobs') : t('dashboard.role.metrics.overdue'),
      value: overdue.length,
      href: '/jobs?status=overdue'
    },
    ...(!isClientRole(role) && !isContractorRole(role)
      ? [
          { label: t('dashboard.role.metrics.customers'), value: customerCount, href: '/customers' },
          { label: t('dashboard.role.metrics.teamMembers'), value: teamCount, href: '/people' }
        ]
      : []),
    { label: t('dashboard.role.metrics.teamPhotos'), value: photoCount, href: '/photos' },
    { label: t('dashboard.role.metrics.teamReports'), value: reportCount, href: '/reports' },
    ...(role === 'owner' || role === 'admin' || role === 'manager'
      ? [
          { label: t('dashboard.role.metrics.teamActivity'), value: activityCount, href: '/people' },
          {
            label: canViewTeamCommandCenter ? t('dashboard.role.metrics.teamJobsThisMonth') : t('dashboard.role.metrics.jobsThisMonth'),
            value: createdThisMonth,
            href: `/jobs?from=${monthStartIso}`
          }
        ]
      : [])
  ].filter((card) => canLink(card.href));

  return (
    <div className="role-dashboard">
      <div className="dashboard-section-head">
        <div>
          <h3>{canViewTeamCommandCenter ? t('dashboard.role.workspaceTitleTeam') : t('dashboard.role.workspaceTitle')}</h3>
          <p className="muted">
            {canViewTeamCommandCenter ? t('dashboard.role.workspaceIntroTeam') : t('dashboard.role.workspaceIntro')}
          </p>
        </div>
        {canViewTeamCommandCenter ? (
          <Link href="/people" className="dashboard-section-link">
            {t('dashboard.role.viewTeam')}
          </Link>
        ) : null}
      </div>

      <div className="stats-grid">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="stat-card" style={{ textDecoration: 'none' }}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </Link>
        ))}
      </div>

      {canViewTeamCommandCenter && canLink('/people') ? (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="dashboard-section-head">
            <div>
              <h4>{t('dashboard.role.teamOverview')}</h4>
              <p className="muted">{t('dashboard.role.teamOverviewHint')}</p>
            </div>
            <Link href="/people" className="dashboard-section-link">
              {t('dashboard.role.manageAccess')}
            </Link>
          </div>
          {teamMembers.length === 0 ? <p className="muted">{t('dashboard.role.noTeamMembers')}</p> : null}
          <div className="team-command-grid">
            {teamMembers.map((member) => (
              <div key={member.id} className="team-command-card">
                <div>
                  <strong>{member.name}</strong>
                  <p className="muted">
                    {member.role} · {workloadLabel(member)}
                  </p>
                </div>
                <div className="stats-grid compact">
                  <Link href={`/jobs?assigned_to=${member.id}&status=active`} className="stat-card" style={{ textDecoration: 'none' }}>
                    <span>{t('dashboard.role.metrics.active')}</span>
                    <strong>{member.activeJobs}</strong>
                  </Link>
                  <Link href={`/schedule?member=${member.id}`} className="stat-card" style={{ textDecoration: 'none' }}>
                    <span>{t('dashboard.role.metrics.dueToday')}</span>
                    <strong>{member.dueToday}</strong>
                  </Link>
                  <Link href={`/jobs?assigned_to=${member.id}&status=overdue`} className="stat-card" style={{ textDecoration: 'none' }}>
                    <span>{t('dashboard.role.metrics.overdue')}</span>
                    <strong>{member.overdue}</strong>
                  </Link>
                </div>
                <p className="muted">
                  {t('dashboard.role.lastActivity')} {formatDate(member.lastActivity)}
                </p>
                <div className="button-row">
                  <Link href={`/jobs?assigned_to=${member.id}`} className="btn btn-sm">
                    {t('dashboard.role.viewWorkload')}
                  </Link>
                  <Link href={`/schedule?member=${member.id}`} className="btn btn-sm">
                    {t('dashboard.teamCommand.member.viewSchedule')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="card role-dashboard-upcoming" style={{ marginTop: 16 }}>
        <div className="dashboard-section-head">
          <h4>{canViewTeamCommandCenter ? t('dashboard.role.upcomingTeamJobs') : t('dashboard.role.upcomingJobs')}</h4>
          <Link href="/schedule" className="dashboard-section-link">
            {t('dashboard.role.openSchedule')}
          </Link>
        </div>
        {upcoming.length === 0 && <p className="muted">{t('dashboard.role.noUpcomingDueDates')}</p>}
        {upcoming.map((job) => (
          <div key={job.id} className="list-row">
            <Link href={`/jobs/${job.id}`}>{job.title}</Link>
            <span>{job.due_date}</span>
          </div>
        ))}
      </div>

      {canViewTeamCommandCenter && canLink('/people') ? (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="dashboard-section-head">
            <h4>{t('dashboard.role.recentTeamActivity')}</h4>
            <Link href="/people" className="dashboard-section-link">
              {t('dashboard.role.viewAuditTrail')}
            </Link>
          </div>
          {recentActivity.length === 0 ? <p className="muted">{t('dashboard.role.noRecentActivity')}</p> : null}
          {recentActivity.map((item) => (
            <div key={item.id} className="list-row">
              <div>
                <strong>{item.message}</strong>
                <p className="muted">{item.actorName || t('dashboard.role.teamMember')}</p>
              </div>
              <span>{formatDate(item.createdAt)}</span>
            </div>
          ))}
        </section>
      ) : null}

      {canViewTeamCommandCenter ? (
        <section className="card" style={{ marginTop: 16 }}>
          <h4>{t('dashboard.role.quickOwnerActions')}</h4>
          <div className="button-row">
            {canLink('/jobs') ? (
              <Link href="/jobs/new" className="btn btn-primary">
                {t('dashboard.role.assignJob')}
              </Link>
            ) : null}
            {canLink('/messages') ? (
              <Link href="/messages" className="btn">
                {t('dashboard.role.quickActions.messageTeam')}
              </Link>
            ) : null}
            {canLink('/schedule') ? (
              <Link href="/schedule" className="btn">
                {t('dashboard.role.quickActions.viewSchedule')}
              </Link>
            ) : null}
            {canLink('/reports') ? (
              <Link href="/reports" className="btn">
                {t('dashboard.role.quickActions.reviewReports')}
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
