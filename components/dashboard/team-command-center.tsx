'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { TeamCommandCenterData, TeamCommandMember, WorkloadStatus } from '@/lib/team-command-center';
import { normalizeTeamCommandCenterData } from '@/lib/team-command-center';

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

function workloadLabel(status: WorkloadStatus, member: TeamCommandMember): string {
  if (member.overdueJobs > 0) return 'Behind';
  if (member.activeJobs > 0) return 'Working';
  if (member.dueTodayJobs > 0) return 'Due today';
  if (status === 'busy') return 'Scheduled';
  if (status === 'overloaded') return 'Overloaded';
  return 'No active work';
}

function memberSummary(member: TeamCommandMember): string {
  if (member.nextUpcomingJob) {
    return `${member.nextUpcomingJob.title} · ${member.nextUpcomingJob.date}`;
  }
  if (member.activeJobs > 0) return `${member.activeJobs} active job${member.activeJobs === 1 ? '' : 's'}`;
  if (member.dueTodayJobs > 0) return `${member.dueTodayJobs} due today`;
  return 'Nothing assigned for today';
}

function statusTone(member: TeamCommandMember): React.CSSProperties {
  if (member.overdueJobs > 0) {
    return { background: 'rgba(140, 58, 48, 0.08)', color: '#73342b', borderColor: 'rgba(140, 58, 48, 0.18)' };
  }
  if (member.activeJobs > 0 || member.dueTodayJobs > 0) {
    return { background: 'rgba(47, 95, 143, 0.08)', color: '#244f76', borderColor: 'rgba(47, 95, 143, 0.18)' };
  }
  return { background: 'rgba(74, 99, 84, 0.1)', color: '#2f5f45', borderColor: 'rgba(74, 99, 84, 0.18)' };
}

export function TeamCommandCenter({ enabled }: TeamCommandCenterProps) {
  const [data, setData] = useState<TeamCommandCenterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

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
      const json = (await res.json()) as TeamCommandCenterData & {
        error?: string;
        detail?: string;
        _detail?: string;
      };
      if (!active) return;
      setLoading(false);
      if (!res.ok) {
        const detail = json.detail || json._detail;
        const message =
          json.error ||
          detail ||
          'We could not load team command center data. Refresh and try again.';
        setError(message);
        setData(null);
        return;
      }
      setData(normalizeTeamCommandCenterData(json));
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
  const safeTotals = totals || {
    teamMembers: 0,
    activeJobs: 0,
    completedJobs: 0,
    overdueJobs: 0,
    customers: 0,
    photos: 0,
    reports: 0,
    teamActivity: 0,
    jobsThisMonth: 0
  };
  const safeMembers = members || [];
  const safeRecentActivity = recentActivity || [];
  const hasMembers = safeMembers.length > 0;
  const hasAssignedWork = safeMembers.some(
    (member) => member.activeJobs > 0 || member.completedJobs > 0 || member.overdueJobs > 0 || member.dueTodayJobs > 0
  );

  const compactMetrics = [
    { label: 'Active', value: safeTotals.activeJobs, href: '/jobs?status=active' },
    { label: 'Due today', value: safeMembers.reduce((sum, member) => sum + member.dueTodayJobs, 0), href: '/schedule' },
    { label: 'Overdue', value: safeTotals.overdueJobs, href: '/jobs?status=overdue' },
    { label: 'Completed', value: safeTotals.completedJobs, href: '/jobs?status=completed' }
  ];

  return (
    <section className="card dashboard-today-card team-command-center" aria-label="Team Command Center">
      <div className="dashboard-section-head">
        <div>
          <h2>Team Command Center</h2>
          <p className="page-subtitle">
            Compact team status with expandable workload details.
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 10,
          marginBottom: 18
        }}
      >
        {compactMetrics.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            style={{
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              background: 'var(--surface)',
              boxShadow: 'var(--shadow-subtle)'
            }}
          >
            <span style={{ display: 'block', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              {card.label}
            </span>
            <strong style={{ display: 'block', marginTop: 4, fontSize: 24, lineHeight: 1.1, color: 'var(--charcoal)' }}>
              {card.value}
            </strong>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 8 }}>
        <h3 style={{ marginBottom: 10 }}>Team overview</h3>
        {!hasMembers ? (
          <p className="muted">No team members yet. Invite team members or assign jobs to see workload here.</p>
        ) : null}
        {hasMembers && !hasAssignedWork ? (
          <p className="muted" style={{ marginBottom: 12 }}>
            No assigned work is being found for any team member. Use each row Data check link to confirm whether the jobs are unassigned or assigned through a different record.
          </p>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {safeMembers.map((member) => {
            const expanded = expandedMemberId === member.userId;
            const totalTracked = member.activeJobs + member.dueTodayJobs + member.overdueJobs + member.completedJobs;
            return (
              <article
                key={member.userId}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--surface)',
                  boxShadow: 'var(--shadow-subtle)',
                  overflow: 'hidden'
                }}
              >
                <button
                  type="button"
                  onClick={() => setExpandedMemberId(expanded ? null : member.userId)}
                  aria-expanded={expanded}
                  style={{
                    width: '100%',
                    border: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'grid',
                    gridTemplateColumns: 'minmax(180px, 1.2fr) minmax(180px, 1.4fr) auto auto',
                    gap: 12,
                    alignItems: 'center',
                    padding: '14px 16px',
                    textAlign: 'left',
                    color: 'var(--text)'
                  }}
                >
                  <span>
                    <strong style={{ display: 'block', color: 'var(--charcoal)' }}>{member.name}</strong>
                    <span className="muted">{member.role} · {member.email || 'No email on file'}</span>
                  </span>
                  <span>
                    <strong style={{ display: 'block', fontWeight: 500 }}>{memberSummary(member)}</strong>
                    <span className="muted">Last update: {formatDate(member.lastActivityAt)}</span>
                  </span>
                  <span
                    style={{
                      justifySelf: 'end',
                      border: '1px solid',
                      borderRadius: 999,
                      padding: '4px 10px',
                      fontSize: 13,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      ...statusTone(member)
                    }}
                  >
                    {workloadLabel(member.workloadStatus, member)}
                  </span>
                  <span aria-hidden="true" style={{ color: 'var(--muted)', fontSize: 18 }}>
                    {expanded ? '−' : '+'}
                  </span>
                </button>

                {expanded ? (
                  <div style={{ borderTop: '1px solid var(--line)', padding: '14px 16px 16px' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                        gap: 10,
                        marginBottom: 14
                      }}
                    >
                      {[
                        ['Active', member.activeJobs],
                        ['Due today', member.dueTodayJobs],
                        ['Overdue', member.overdueJobs],
                        ['Completed', member.completedJobs]
                      ].map(([label, value]) => (
                        <div key={String(label)} className="stat-card" style={{ padding: 12 }}>
                          <span>{label}</span>
                          <strong style={{ fontSize: 22 }}>{value}</strong>
                        </div>
                      ))}
                    </div>

                    {member.nextUpcomingJob ? (
                      <p className="muted" style={{ marginTop: 0 }}>
                        Next job: <Link href={`/jobs/${member.nextUpcomingJob.id}`}>{member.nextUpcomingJob.title}</Link> on {member.nextUpcomingJob.date}
                      </p>
                    ) : (
                      <p className="muted" style={{ marginTop: 0 }}>No upcoming assigned job found.</p>
                    )}

                    <p className="muted">
                      Data check: {totalTracked === 0 ? '0 matching assigned jobs were found for this team member.' : `${totalTracked} matching job record${totalTracked === 1 ? '' : 's'} found.`} Counts use this workspace, job assignment, date, and status filters.
                    </p>

                    <div className="team-command-member-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <Link className="btn btn-sm" href={`/jobs?assigned_to=${member.userId}`}>
                        Data check
                      </Link>
                      <Link className="btn btn-sm" href={`/schedule?member=${member.userId}`}>
                        Schedule
                      </Link>
                      <Link className="btn btn-sm btn-primary" href={`/jobs/new?assigned_to=${member.userId}`}>
                        Assign job
                      </Link>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>

      <details style={{ marginTop: 18 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }}>More workspace metrics</summary>
        <div className="dashboard-revenue-grid" style={{ marginTop: 12 }}>
          {[
            { label: 'Customers', value: safeTotals.customers, href: '/customers' },
            { label: 'Team members', value: safeTotals.teamMembers, href: '/team' },
            { label: 'Photos', value: safeTotals.photos, href: '/photos' },
            { label: 'Reports', value: safeTotals.reports, href: '/activity' },
            { label: 'Team activity', value: safeTotals.teamActivity, href: '/activity' },
            { label: 'Jobs this month', value: safeTotals.jobsThisMonth, href: `/jobs?from=${jobsThisMonthFrom || ''}` }
          ].map((card) => (
            <Link key={card.label} href={card.href} className="dashboard-revenue-metric">
              <span className="dashboard-revenue-metric-label">{card.label}</span>
              <strong className="dashboard-revenue-metric-value">{card.value}</strong>
            </Link>
          ))}
        </div>
      </details>

      <details style={{ marginTop: 18 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }}>Recent team activity</summary>
        {safeRecentActivity.length === 0 ? (
          <p className="muted">No recent team activity yet.</p>
        ) : (
          <ul className="team-command-activity-list">
            {safeRecentActivity.map((item) => (
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
      </details>
    </section>
  );
}
