'use client';

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import type { TeamCommandCenterData, TeamCommandMember, WorkloadStatus } from '@/lib/team-command-center';
import { normalizeTeamCommandCenterData } from '@/lib/team-command-center';

type TeamCommandCenterProps = {
  enabled: boolean;
};

type MemberWithAvatar = TeamCommandMember & {
  avatarUrl?: string | null;
  profilePhotoUrl?: string | null;
  photoUrl?: string | null;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not updated yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not updated yet';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function initialsFor(member: TeamCommandMember): string {
  const source = member.name || member.email || 'Team Member';
  const parts = source
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2);
  return (parts.map((part) => part[0]).join('') || 'TM').toUpperCase();
}

function avatarUrlFor(member: TeamCommandMember): string | null {
  const withAvatar = member as MemberWithAvatar;
  return withAvatar.avatarUrl || withAvatar.profilePhotoUrl || withAvatar.photoUrl || null;
}

function statusLabel(status: WorkloadStatus, member: TeamCommandMember): string {
  if (member.overdueJobs > 0) return 'Needs attention';
  if (member.activeJobs > 0) return 'On job';
  if (member.dueTodayJobs > 0) return 'Scheduled';
  if (status === 'busy') return 'Scheduled';
  if (status === 'overloaded') return 'Overloaded';
  return 'Available';
}

function memberSummary(member: TeamCommandMember): string {
  if (member.nextUpcomingJob) return member.nextUpcomingJob.title;
  if (member.activeJobs > 0) return `${member.activeJobs} active job${member.activeJobs === 1 ? '' : 's'}`;
  if (member.dueTodayJobs > 0) return `${member.dueTodayJobs} due today`;
  return 'Ready for assignment';
}

function statusTone(member: TeamCommandMember): CSSProperties {
  if (member.overdueJobs > 0) {
    return { background: 'rgba(140, 58, 48, 0.08)', color: '#73342b', borderColor: 'rgba(140, 58, 48, 0.2)' };
  }
  if (member.activeJobs > 0 || member.dueTodayJobs > 0) {
    return { background: 'rgba(47, 95, 143, 0.08)', color: '#244f76', borderColor: 'rgba(47, 95, 143, 0.2)' };
  }
  return { background: 'rgba(74, 99, 84, 0.1)', color: '#2f5f45', borderColor: 'rgba(74, 99, 84, 0.2)' };
}

function smallMetric(label: string, value: number) {
  return (
    <div className="stat-card" style={{ padding: 12, minWidth: 0 }}>
      <span>{label}</span>
      <strong style={{ fontSize: 22 }}>{value}</strong>
    </div>
  );
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
        setError(json.error || detail || 'We could not load team command center data. Refresh and try again.');
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

  const { totals, members } = data;
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
  const hasMembers = safeMembers.length > 0;
  const availableMembers = safeMembers.filter((member) => member.activeJobs === 0 && member.overdueJobs === 0).length;
  const dueTodayTotal = safeMembers.reduce((sum, member) => sum + member.dueTodayJobs, 0);

  const compactMetrics = [
    { label: 'On job', value: safeTotals.activeJobs, href: '/jobs?status=active' },
    { label: 'Due today', value: dueTodayTotal, href: '/schedule' },
    { label: 'Needs attention', value: safeTotals.overdueJobs, href: '/jobs?status=overdue' },
    { label: 'Available team', value: availableMembers, href: '/team' }
  ];

  return (
    <section className="card dashboard-today-card team-command-center" aria-label="Team Command Center">
      <div className="dashboard-section-head" style={{ marginBottom: 22 }}>
        <div>
          <h2>Team Command Center</h2>
          <p className="page-subtitle" style={{ marginTop: 8, marginBottom: 0 }}>
            See who is available, scheduled, or needs attention today.
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 14,
          marginBottom: 32
        }}
      >
        {compactMetrics.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            style={{
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              background: 'var(--surface)',
              boxShadow: 'var(--shadow-subtle)',
              minWidth: 0
            }}
          >
            <span style={{ display: 'block', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              {card.label}
            </span>
            <strong style={{ display: 'block', marginTop: 6, fontSize: 24, lineHeight: 1.1, color: 'var(--charcoal)' }}>
              {card.value}
            </strong>
          </Link>
        ))}
      </div>

      <div>
        <h3 style={{ margin: '0 0 10px' }}>Team overview</h3>
        <p className="muted" style={{ margin: '0 0 22px', maxWidth: 760, lineHeight: 1.55 }}>
          Open a team member to view schedule, assignment, and contact actions.
        </p>

        {!hasMembers ? (
          <p className="muted">No team members yet. Invite team members or assign jobs to see workload here.</p>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {safeMembers.map((member) => {
            const expanded = expandedMemberId === member.userId;
            const avatarUrl = avatarUrlFor(member);
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
                    gridTemplateColumns: 'minmax(240px, 1.2fr) minmax(220px, 1fr) max-content 24px',
                    columnGap: 24,
                    rowGap: 14,
                    alignItems: 'center',
                    padding: '18px 20px',
                    textAlign: 'left',
                    color: 'var(--text)'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 44,
                        height: 44,
                        flex: '0 0 44px',
                        borderRadius: '50%',
                        border: '1px solid var(--line)',
                        background: 'var(--bg)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        color: 'var(--charcoal)',
                        fontWeight: 700,
                        fontSize: 14
                      }}
                    >
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        initialsFor(member)
                      )}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block', color: 'var(--charcoal)', lineHeight: 1.25, overflowWrap: 'anywhere' }}>
                        {member.name}
                      </strong>
                      <span className="muted" style={{ display: 'block', lineHeight: 1.35, marginTop: 4, overflowWrap: 'anywhere' }}>
                        {member.role} · {member.email || 'No email on file'}
                      </span>
                    </span>
                  </span>

                  <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                    <strong style={{ display: 'block', fontWeight: 500, lineHeight: 1.25 }}>{memberSummary(member)}</strong>
                    <span className="muted" style={{ display: 'block', lineHeight: 1.35, marginTop: 6 }}>
                      {member.nextUpcomingJob ? `Next: ${member.nextUpcomingJob.date}` : `Updated: ${formatDate(member.lastActivityAt)}`}
                    </span>
                  </span>

                  <span
                    style={{
                      justifySelf: 'end',
                      border: '1px solid',
                      borderRadius: 999,
                      padding: '5px 12px',
                      fontSize: 13,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      ...statusTone(member)
                    }}
                  >
                    {statusLabel(member.workloadStatus, member)}
                  </span>
                  <span aria-hidden="true" style={{ color: 'var(--muted)', fontSize: 18, justifySelf: 'end' }}>
                    {expanded ? '−' : '+'}
                  </span>
                </button>

                {expanded ? (
                  <div style={{ borderTop: '1px solid var(--line)', padding: '16px 20px 18px' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                        gap: 10,
                        marginBottom: 16
                      }}
                    >
                      {smallMetric('Active', member.activeJobs)}
                      {smallMetric('Due today', member.dueTodayJobs)}
                      {smallMetric('Overdue', member.overdueJobs)}
                      {smallMetric('Completed', member.completedJobs)}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
                      <div>
                        <strong style={{ display: 'block', color: 'var(--charcoal)' }}>Next assignment</strong>
                        {member.nextUpcomingJob ? (
                          <p className="muted" style={{ margin: '4px 0 0' }}>
                            <Link href={`/jobs/${member.nextUpcomingJob.id}`}>{member.nextUpcomingJob.title}</Link> · {member.nextUpcomingJob.date}
                          </p>
                        ) : (
                          <p className="muted" style={{ margin: '4px 0 0' }}>No scheduled assignment yet.</p>
                        )}
                      </div>
                      <div>
                        <strong style={{ display: 'block', color: 'var(--charcoal)' }}>Contact</strong>
                        <p className="muted" style={{ margin: '4px 0 0', overflowWrap: 'anywhere' }}>
                          {member.email || 'No email on file'}
                        </p>
                      </div>
                    </div>

                    <div className="team-command-member-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <Link className="btn btn-sm" href={`/schedule?member=${member.userId}`}>
                        View schedule
                      </Link>
                      <Link className="btn btn-sm" href={`/jobs?assigned_to=${member.userId}`}>
                        View jobs
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
    </section>
  );
}
