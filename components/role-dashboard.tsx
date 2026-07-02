'use client';

import Link from 'next/link';
import { isClientRole, isContractorRole, type UserRole } from '@/lib/roles';

type JobRow = {
  id: string;
  title: string;
  status: string | null;
  due_date: string | null;
  start_date: string | null;
};

type RoleDashboardProps = {
  role: UserRole;
  jobs: JobRow[];
  photoCount: number;
  reportCount: number;
  activityCount: number;
  customerCount?: number;
  teamCount?: number;
};

export function RoleDashboard({
  role,
  jobs,
  photoCount,
  reportCount,
  activityCount,
  customerCount = 0,
  teamCount = 0
}: RoleDashboardProps) {
  const active = jobs.filter((j) => j.status !== 'completed' && j.status !== 'cancelled');
  const completed = jobs.filter((j) => j.status === 'completed');
  const overdue = active.filter((j) => j.due_date && j.due_date < new Date().toISOString().slice(0, 10));
  const upcoming = active
    .filter((j) => j.due_date)
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
    .slice(0, 8);

  const monthStart = new Date();
  monthStart.setDate(1);
  const createdThisMonth = jobs.filter((j) => j.start_date && j.start_date >= monthStart.toISOString().slice(0, 10)).length;
  const isOwnerOrManager = role === 'owner' || role === 'manager';
  const workspaceTitle = role === 'owner' ? 'Team manager dashboard' : 'Your workspace';
  const workspaceIntro = role === 'owner'
    ? 'This shows the same operational work your managers see across the team.'
    : 'Track your active work, schedule, photos, reports, and team activity.';

  return (
    <div className="role-dashboard">
      <div className="dashboard-section-head">
        <div>
          <h3>{workspaceTitle}</h3>
          <p className="muted">{workspaceIntro}</p>
        </div>
        {role === 'owner' ? (
          <Link href="/team" className="dashboard-section-link">
            View team
          </Link>
        ) : null}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span>{role === 'owner' ? 'Team active jobs' : 'Active jobs'}</span>
          <strong>{active.length}</strong>
        </div>
        <div className="stat-card">
          <span>{role === 'owner' ? 'Team completed jobs' : 'Completed'}</span>
          <strong>{completed.length}</strong>
        </div>
        <div className="stat-card">
          <span>{role === 'owner' ? 'Team overdue jobs' : 'Overdue'}</span>
          <strong>{overdue.length}</strong>
        </div>
        {!isClientRole(role) && !isContractorRole(role) && (
          <>
            <div className="stat-card">
              <span>Customers</span>
              <strong>{customerCount}</strong>
            </div>
            <div className="stat-card">
              <span>Team members</span>
              <strong>{teamCount}</strong>
            </div>
          </>
        )}
        <div className="stat-card">
          <span>Team photos</span>
          <strong>{photoCount}</strong>
        </div>
        <div className="stat-card">
          <span>Team reports</span>
          <strong>{reportCount}</strong>
        </div>
        {isOwnerOrManager && (
          <div className="stat-card">
            <span>Team activity</span>
            <strong>{activityCount}</strong>
          </div>
        )}
        {isOwnerOrManager && (
          <div className="stat-card">
            <span>{role === 'owner' ? 'Team jobs this month' : 'Jobs this month'}</span>
            <strong>{createdThisMonth}</strong>
          </div>
        )}
      </div>

      <div className="card role-dashboard-upcoming" style={{ marginTop: 16 }}>
        <h4>{role === 'owner' ? 'Upcoming team jobs' : 'Upcoming jobs'}</h4>
        {upcoming.length === 0 && <p className="muted">No upcoming due dates.</p>}
        {upcoming.map((job) => (
          <div key={job.id} className="list-row">
            <Link href={`/jobs/${job.id}`}>{job.title}</Link>
            <span>{job.due_date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
