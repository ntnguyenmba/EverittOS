'use client';

import Link from 'next/link';
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
};

function formatDate(value: string | null | undefined) {
  if (!value) return 'No activity yet';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function displayDate(value: string | null | undefined) {
  if (!value) return 'Not scheduled';
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function workloadLabel(member: TeamMemberSummary) {
  if (!member.active) return 'Inactive';
  if (member.overdue > 0 || member.activeJobs >= 8) return 'Overloaded';
  if (member.activeJobs >= 4 || member.dueToday > 0) return 'Busy';
  return 'Available';
}

function FieldWorkerDashboard({ jobs, photoCount }: { jobs: JobRow[]; photoCount: number }) {
  const today = new Date().toISOString().slice(0, 10);
  const active = jobs.filter((j) => j.status !== 'completed' && j.status !== 'cancelled');
  const todayJobs = active.filter((j) => (j.start_date || j.due_date || '').slice(0, 10) === today);
  const nextJobs = active
    .filter((j) => !todayJobs.some((todayJob) => todayJob.id === j.id))
    .sort((a, b) => (a.start_date || a.due_date || '').localeCompare(b.start_date || b.due_date || ''))
    .slice(0, 6);
  const completed = jobs.filter((j) => j.status === 'completed');
  const primaryJob = todayJobs[0] || active[0] || null;

  return (
    <div className="role-dashboard field-dashboard">
      <div className="dashboard-section-head">
        <div>
          <h3>My field work</h3>
          <p className="muted">A simple view for assigned jobs, photos, checklist work, and customer contact.</p>
        </div>
        <Link href="/schedule" className="dashboard-section-link">
          Open schedule
        </Link>
      </div>

      <div className="stats-grid">
        <Link href="/jobs?mine=true" className="stat-card" style={{ textDecoration: 'none' }}>
          <span>My active jobs</span>
          <strong>{active.length}</strong>
        </Link>
        <Link href="/schedule" className="stat-card" style={{ textDecoration: 'none' }}>
          <span>Due today</span>
          <strong>{todayJobs.length}</strong>
        </Link>
        <Link href="/jobs?status=completed&mine=true" className="stat-card" style={{ textDecoration: 'none' }}>
          <span>Completed</span>
          <strong>{completed.length}</strong>
        </Link>
        <Link href="/photos" className="stat-card" style={{ textDecoration: 'none' }}>
          <span>Photos uploaded</span>
          <strong>{photoCount}</strong>
        </Link>
      </div>

      {primaryJob ? (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="dashboard-section-head">
            <div>
              <h4>Current job</h4>
              <p className="muted">Open the job to start, complete checklist items, upload photos, or mark it complete.</p>
            </div>
            <Link href={`/jobs/${primaryJob.id}`} className="btn btn-primary">
              Open job
            </Link>
          </div>
          <div className="list-row">
            <div>
              <strong>{primaryJob.title}</strong>
              <p className="muted">{primaryJob.address || primaryJob.customer_name || 'No customer details added'}</p>
            </div>
            <span>{displayDate(primaryJob.start_date || primaryJob.due_date)}</span>
          </div>
          <div className="button-row" style={{ marginTop: 12 }}>
            <Link href={`/jobs/${primaryJob.id}`} className="btn btn-primary">
              Start or finish job
            </Link>
            {primaryJob.phone ? (
              <a href={`tel:${primaryJob.phone}`} className="btn">
                Call customer
              </a>
            ) : null}
            {primaryJob.address ? (
              <a href={`https://maps.google.com/?q=${encodeURIComponent(primaryJob.address)}`} className="btn" target="_blank" rel="noreferrer">
                Start navigation
              </a>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="card" style={{ marginTop: 16 }}>
          <h4>No assigned field work</h4>
          <p className="muted">Jobs assigned to you will appear here with status, customer contact, photos, and checklist actions.</p>
        </section>
      )}

      <section className="card role-dashboard-upcoming" style={{ marginTop: 16 }}>
        <div className="dashboard-section-head">
          <h4>My jobs today</h4>
          <Link href="/jobs?mine=true" className="dashboard-section-link">
            View all
          </Link>
        </div>
        {todayJobs.length === 0 && <p className="muted">No jobs due today.</p>}
        {todayJobs.map((job) => (
          <div key={job.id} className="list-row">
            <div>
              <Link href={`/jobs/${job.id}`}>{job.title}</Link>
              <p className="muted">{job.address || job.customer_name || 'No location added'}</p>
            </div>
            <span>{job.status || 'new'}</span>
          </div>
        ))}
      </section>

      <section className="card role-dashboard-upcoming" style={{ marginTop: 16 }}>
        <div className="dashboard-section-head">
          <h4>Next assigned jobs</h4>
          <Link href="/schedule" className="dashboard-section-link">
            Open schedule
          </Link>
        </div>
        {nextJobs.length === 0 && <p className="muted">No upcoming assigned jobs.</p>}
        {nextJobs.map((job) => (
          <div key={job.id} className="list-row">
            <div>
              <Link href={`/jobs/${job.id}`}>{job.title}</Link>
              <p className="muted">{job.address || job.customer_name || 'No location added'}</p>
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
  recentActivity = []
}: RoleDashboardProps) {
  if (isStaffRole(role)) {
    return <FieldWorkerDashboard jobs={jobs} photoCount={photoCount} />;
  }

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
  const workspaceTitle = canViewTeamCommandCenter ? 'Team command center' : 'Your workspace';
  const workspaceIntro = canViewTeamCommandCenter
    ? 'Owner and admin view across this workspace only. Each card opens the records behind the number.'
    : 'Track your active work, schedule, photos, reports, and team activity.';

  const cards = [
    { label: canViewTeamCommandCenter ? 'Team active jobs' : 'Active jobs', value: active.length, href: '/jobs?status=active' },
    { label: canViewTeamCommandCenter ? 'Team completed jobs' : 'Completed', value: completed.length, href: '/jobs?status=completed' },
    { label: canViewTeamCommandCenter ? 'Team overdue jobs' : 'Overdue', value: overdue.length, href: '/jobs?status=overdue' },
    ...(!isClientRole(role) && !isContractorRole(role)
      ? [
          { label: 'Customers', value: customerCount, href: '/customers' },
          { label: 'Team members', value: teamCount, href: '/team' }
        ]
      : []),
    { label: 'Team photos', value: photoCount, href: '/photos' },
    { label: 'Team reports', value: reportCount, href: '/reports' },
    ...(role === 'owner' || role === 'admin' || role === 'manager'
      ? [
          { label: 'Team activity', value: activityCount, href: '/team' },
          { label: canViewTeamCommandCenter ? 'Team jobs this month' : 'Jobs this month', value: createdThisMonth, href: `/jobs?from=${monthStartIso}` }
        ]
      : [])
  ];

  return (
    <div className="role-dashboard">
      <div className="dashboard-section-head">
        <div>
          <h3>{workspaceTitle}</h3>
          <p className="muted">{workspaceIntro}</p>
        </div>
        {canViewTeamCommandCenter ? (
          <Link href="/team" className="dashboard-section-link">
            View team
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

      {canViewTeamCommandCenter ? (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="dashboard-section-head">
            <div>
              <h4>Team overview</h4>
              <p className="muted">See each person's workload without leaving the owner dashboard.</p>
            </div>
            <Link href="/team" className="dashboard-section-link">
              Manage access
            </Link>
          </div>
          {teamMembers.length === 0 ? <p className="muted">No active team members found.</p> : null}
          <div className="team-command-grid">
            {teamMembers.map((member) => (
              <div key={member.id} className="team-command-card">
                <div>
                  <strong>{member.name}</strong>
                  <p className="muted">{member.role} · {workloadLabel(member)}</p>
                </div>
                <div className="stats-grid compact">
                  <Link href={`/jobs?assigned_to=${member.id}&status=active`} className="stat-card" style={{ textDecoration: 'none' }}>
                    <span>Active</span>
                    <strong>{member.activeJobs}</strong>
                  </Link>
                  <Link href={`/schedule?member=${member.id}`} className="stat-card" style={{ textDecoration: 'none' }}>
                    <span>Due today</span>
                    <strong>{member.dueToday}</strong>
                  </Link>
                  <Link href={`/jobs?assigned_to=${member.id}&status=overdue`} className="stat-card" style={{ textDecoration: 'none' }}>
                    <span>Overdue</span>
                    <strong>{member.overdue}</strong>
                  </Link>
                </div>
                <p className="muted">Last activity: {formatDate(member.lastActivity)}</p>
                <div className="button-row">
                  <Link href={`/jobs?assigned_to=${member.id}`} className="btn btn-sm">
                    View workload
                  </Link>
                  <Link href={`/schedule?member=${member.id}`} className="btn btn-sm">
                    View schedule
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="card role-dashboard-upcoming" style={{ marginTop: 16 }}>
        <div className="dashboard-section-head">
          <h4>{canViewTeamCommandCenter ? 'Upcoming team jobs' : 'Upcoming jobs'}</h4>
          <Link href="/schedule" className="dashboard-section-link">
            Open schedule
          </Link>
        </div>
        {upcoming.length === 0 && <p className="muted">No upcoming due dates.</p>}
        {upcoming.map((job) => (
          <div key={job.id} className="list-row">
            <Link href={`/jobs/${job.id}`}>{job.title}</Link>
            <span>{job.due_date}</span>
          </div>
        ))}
      </div>

      {canViewTeamCommandCenter ? (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="dashboard-section-head">
            <h4>Recent team activity</h4>
            <Link href="/team" className="dashboard-section-link">
              View audit trail
            </Link>
          </div>
          {recentActivity.length === 0 ? <p className="muted">No recent activity yet.</p> : null}
          {recentActivity.map((item) => (
            <div key={item.id} className="list-row">
              <div>
                <strong>{item.message}</strong>
                <p className="muted">{item.actorName || 'Team member'}</p>
              </div>
              <span>{formatDate(item.createdAt)}</span>
            </div>
          ))}
        </section>
      ) : null}

      {canViewTeamCommandCenter ? (
        <section className="card" style={{ marginTop: 16 }}>
          <h4>Quick owner actions</h4>
          <div className="button-row">
            <Link href="/jobs/new" className="btn btn-primary">
              Assign job
            </Link>
            <Link href="/messages" className="btn">
              Message team
            </Link>
            <Link href="/schedule" className="btn">
              View schedule
            </Link>
            <Link href="/reports" className="btn">
              Review reports
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
