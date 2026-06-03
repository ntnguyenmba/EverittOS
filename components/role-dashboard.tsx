'use client';

import Link from 'next/link';
import { dashboardVariant, type UserRole } from '@/lib/roles';

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
};

export function RoleDashboard({ role, jobs, photoCount, reportCount, activityCount }: RoleDashboardProps) {
  const variant = dashboardVariant(role);
  const active = jobs.filter((j) => j.status !== 'completed' && j.status !== 'cancelled');
  const completed = jobs.filter((j) => j.status === 'completed');
  const overdue = active.filter((j) => j.due_date && j.due_date < new Date().toISOString().slice(0, 10));
  const upcoming = active
    .filter((j) => j.due_date)
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
    .slice(0, 5);

  const titles: Record<string, string> = {
    owner: 'Owner dashboard',
    admin: 'Admin dashboard',
    manager: 'Manager dashboard',
    crew: 'Crew dashboard'
  };

  return (
    <div className="role-dashboard">
      <h3>{titles[variant]}</h3>
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
        <div className="stat-card">
          <span>Photos</span>
          <strong>{photoCount}</strong>
        </div>
        <div className="stat-card">
          <span>Reports</span>
          <strong>{reportCount}</strong>
        </div>
        {variant !== 'crew' && (
          <div className="stat-card">
            <span>Team activity</span>
            <strong>{activityCount}</strong>
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
