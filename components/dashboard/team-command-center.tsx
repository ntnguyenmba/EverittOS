'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { TeamCommandCenterData, WorkloadStatus } from '@/lib/team-command-center';

type TeamCommandCenterProps = {
  enabled: boolean;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function workloadLabel(status: WorkloadStatus): string {
  if (status === 'available') return 'Available';
  if (status === 'busy') return 'Busy';
  return 'Overloaded';
}

export function TeamCommandCenter({ enabled }: TeamCommandCenterProps) {
  const [data, setData] = useState<TeamCommandCenterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setError('');
      return;
    }

    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      const res = await fetch('/api/dashboard/team-command');
      const json = (await res.json()) as TeamCommandCenterData & { error?: string };
      if (!active) return;
      setLoading(false);
      if (!res.ok) {
        setError(json.error || 'We could not load team command center data. Refresh and try again.');
        setData(null);
        return;
      }
      setData(json);
    }

    void load();
    return () => {
      active = false;
    };
  }, [enabled]);

  if (!enabled) return null;

  if (loading) {
    return (
      <section className="card dashboard-today-card" aria-label="Team Command Center">
        <p className="loading-state" role="status">
          Loading team command center...
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card dashboard-today-card" aria-label="Team Command Center">
        <p className="auth-message auth-message-error">{error}</p>
      </section>
    );
  }

  if (!data) return null;

  const { totals, members, recentActivity, jobsThisMonthFrom } = data;
  const hasMembers = members.length > 0;
  const hasWorkload = members.some(
    (member) =>
      member.activeJobs > 0 ||
      member.completedJobs > 0 ||
      member.overdueJobs > 0 ||
      member.dueTodayJobs > 0 ||
      member.lastActivityAt
  );

  const metricCards = [
    { label: 'Active jobs', value: totals.activeJobs, href: '/jobs?status=active' },
    { label: 'Completed jobs', value: totals.completedJobs, href: '/jobs?status=completed' },
    { label: 'Overdue jobs', value: totals.overdueJobs, href: '/jobs?status=overdue' },
    { label: 'Customers', value: totals.customers, href: '/customers' },
    { label: 'Team members', value: totals.teamMembers, href: '/team' },
    { label: 'Photos', value: totals.photos, href: '/photos' },
    { label: 'Reports', value: totals.reports, href: '/activity' },
    { label: 'Team activity', value: totals.teamActivity, href: '/activity' },
    { label: 'Jobs this month', value: totals.jobsThisMonth, href: `/jobs?from=${jobsThisMonthFrom}` }
  ];

  return (
    <section className="card dashboard-today-card team-command-center" aria-label="Team Command Center">
      <div className="dashboard-section-head">
        <div>
          <h2>Team Command Center</h2>
          <p className="page-subtitle">
            See team workload, activity, schedule, and records for this workspace.
          </p>
        </div>
      </div>

      <div className="dashboard-revenue-grid">
        {metricCards.map((card) => (
          <Link key={card.label} href={card.href} className="dashboard-revenue-metric">
            <span className="dashboard-revenue-metric-label">{card.label}</span>
            <strong className="dashboard-revenue-metric-value">{card.value}</strong>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <h3>Team overview</h3>
        {!hasMembers ? (
          <p className="muted">
            No team workload yet. Invite team members or assign jobs to see activity here.
          </p>
        ) : null}
        {hasMembers && !hasWorkload ? (
          <p className="muted">
            Team members are connected, but no assigned jobs yet. Assign work to populate workload cards.
          </p>
        ) : null}
        <div className="team-command-members">
          {members.map((member) => (
            <article key={member.userId} className="card team-command-member-card">
              <div className="team-command-member-head">
                <div>
                  <strong>{member.name}</strong>
                  <p className="muted">{member.email || 'No email on file'}</p>
                </div>
                <span className={`team-workload-pill team-workload-${member.workloadStatus}`}>
                  {workloadLabel(member.workloadStatus)}
                </span>
              </div>
              <p className="muted" style={{ marginTop: 8 }}>
                Role: {member.role}
              </p>
              <div className="stats-grid" style={{ marginTop: 12 }}>
                <div className="stat-card">
                  <span>Active</span>
                  <strong>{member.activeJobs}</strong>
                </div>
                <div className="stat-card">
                  <span>Due today</span>
                  <strong>{member.dueTodayJobs}</strong>
                </div>
                <div className="stat-card">
                  <span>Overdue</span>
                  <strong>{member.overdueJobs}</strong>
                </div>
                <div className="stat-card">
                  <span>Completed</span>
                  <strong>{member.completedJobs}</strong>
                </div>
              </div>
              <p className="muted" style={{ marginTop: 12 }}>
                Last activity: {formatDate(member.lastActivityAt)}
              </p>
              {member.nextUpcomingJob ? (
                <p className="muted">
                  Next job:{' '}
                  <Link href={`/jobs/${member.nextUpcomingJob.id}`}>{member.nextUpcomingJob.title}</Link>{' '}
                  ({member.nextUpcomingJob.date})
                </p>
              ) : null}
              <div className="team-command-member-actions">
                <Link className="btn btn-sm" href={`/jobs?assigned_to=${member.userId}`}>
                  View workload
                </Link>
                <Link className="btn btn-sm" href={`/schedule?member=${member.userId}`}>
                  View schedule
                </Link>
                <Link className="btn btn-sm" href="/messages">
                  Message
                </Link>
                <Link className="btn btn-sm btn-primary" href={`/jobs/new?assigned_to=${member.userId}`}>
                  Assign job
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <h3>Recent team activity</h3>
        {recentActivity.length === 0 ? (
          <p className="muted">No recent team activity yet.</p>
        ) : (
          <ul className="team-command-activity-list">
            {recentActivity.map((item) => (
              <li key={item.id} className="activity-item">
                <div>
                  {item.href ? (
                    <Link href={item.href}>{item.message || 'Activity update'}</Link>
                  ) : (
                    <span>{item.message || 'Activity update'}</span>
                  )}
                </div>
                <p className="muted">
                  {item.actorName || 'Team member'} · {formatDate(item.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
