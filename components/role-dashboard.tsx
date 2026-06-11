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
    .slice(0, 5);

  const monthStart = new Date();
  monthStart.setDate(1);
  const createdThisMonth = jobs.filter((j) => j.start_date && j.start_date >= monthStart.toISOString().slice(0, 10)).length;

  return (
    <div className="role-dashboard">
      <h3>Your workspace</h3>
      <div className="stats-grid">
        <div className="stat-card">
          <span>Active jobs</span>
          <strong>{active.length}</strong>
        </div>
        <div className="stat-card">
          <span>Completed</span>
          <strong>{completed.length}</strong>
        </div>
        <div className="stat-card">
          <span>Overdue</span>
          <strong>{overdue.length}</strong>
        </div>
        {!isClientRole(role) && !isContractorRole(role) && (
          <>
            <div className="stat-card">
              <span>Customers</span>
              <strong>{customerCount}</strong>
            </div>
            <div className="stat-card">
              <span>Team</span>
              <strong>{teamCount}</strong>
            </div>
          </>
        )}
        <div className="stat-card">
          <span>Photos</span>
          <strong>{photoCount}</strong>
        </div>
        <div className="stat-card">
          <span>Reports</span>
          <strong>{reportCount}</strong>
        </div>
        {(role === 'owner' || role === 'manager') && (
          <div className="stat-card">
            <span>Team activity</span>
            <strong>{activityCount}</strong>
          </div>
        )}
        {(role === 'owner' || role === 'manager') && (
          <div className="stat-card">
            <span>Jobs this month</span>
            <strong>{createdThisMonth}</strong>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h4>Upcoming jobs</h4>
        {upcoming.length === 0 && <p>No upcoming due dates.</p>}
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
