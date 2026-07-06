'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from '@/components/locale-provider';
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

function avatarUrlFor(member: TeamCommandMember): string | null {
  const withAvatar = member as MemberWithAvatar;
  return withAvatar.avatarUrl || withAvatar.profilePhotoUrl || withAvatar.photoUrl || null;
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

export function TeamCommandCenter({ enabled }: TeamCommandCenterProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<TeamCommandCenterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  const initialsFor = (member: TeamCommandMember): string => {
    const source = member.name || member.email || t('dashboard.teamCommand.member.defaultName');
    const parts = source
      .replace(/@.*/, '')
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2);
    return (parts.map((part) => part[0]).join('') || 'TM').toUpperCase();
  };

  const statusLabel = (status: WorkloadStatus, member: TeamCommandMember): string => {
    if (member.overdueJobs > 0) return t('dashboard.teamCommand.status.needsAttention');
    if (member.activeJobs > 0) return t('dashboard.teamCommand.status.onJob');
    if (member.dueTodayJobs > 0) return t('dashboard.teamCommand.status.scheduled');
    if (status === 'busy') return t('dashboard.teamCommand.status.scheduled');
    if (status === 'overloaded') return t('dashboard.teamCommand.status.overloaded');
    return '';
  };

  const shouldShowStatusPill = (member: TeamCommandMember): boolean =>
    member.overdueJobs > 0 ||
    member.activeJobs > 0 ||
    member.dueTodayJobs > 0 ||
    member.workloadStatus === 'busy' ||
    member.workloadStatus === 'overloaded';

  const memberSummary = (member: TeamCommandMember): string | null => {
    if (member.nextUpcomingJob) return member.nextUpcomingJob.title;
    if (member.activeJobs > 0) {
      return member.activeJobs === 1
        ? t('dashboard.teamCommand.summary.activeJobsOne', { count: member.activeJobs })
        : t('dashboard.teamCommand.summary.activeJobsMany', { count: member.activeJobs });
    }
    if (member.dueTodayJobs > 0) {
      return t('dashboard.teamCommand.summary.dueTodayCount', { count: member.dueTodayJobs });
    }
    return null;
  };

  const smallMetric = (label: string, value: number) => (
    <div className="stat-card" style={{ padding: 12, minWidth: 0 }}>
      <span>{label}</span>
      <strong style={{ fontSize: 22 }}>{value}</strong>
    </div>
  );

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
        setError(json.error || detail || t('dashboard.teamCommand.loadError'));
        setData(null);
        return;
      }
      setData(normalizeTeamCommandCenterData(json));
    }

    void load();
    return () => {
      active = false;
    };
  }, [enabled, t]);

  const compactMetrics = useMemo(() => {
    if (!data) return [];
    const safeMembers = data.members || [];
    const dueTodayTotal = safeMembers.reduce((sum, member) => sum + member.dueTodayJobs, 0);
    const safeTotals = data.totals || {
      activeJobs: 0,
      overdueJobs: 0
    };
    return [
      { label: t('dashboard.teamCommand.metrics.onJob'), value: safeTotals.activeJobs, href: '/jobs?status=active' },
      { label: t('dashboard.teamCommand.metrics.dueToday'), value: dueTodayTotal, href: '/schedule' },
      { label: t('dashboard.teamCommand.metrics.needsAttention'), value: safeTotals.overdueJobs, href: '/jobs?status=overdue' }
    ];
  }, [data, t]);

  if (!enabled) return null;

  const ariaLabel = t('dashboard.teamCommand.ariaLabel');

  if (loading) {
    return (
      <section className="card dashboard-today-card" aria-label={ariaLabel}>
        <p className="loading-state" role="status">
          {t('dashboard.teamCommand.loading')}
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card dashboard-today-card" aria-label={ariaLabel}>
        <p className="auth-message auth-message-error">{error}</p>
      </section>
    );
  }

  if (!data) return null;

  const safeMembers = data.members || [];
  const hasMembers = safeMembers.length > 0;

  return (
    <section className="card dashboard-today-card team-command-center" aria-label={ariaLabel}>
      <div className="dashboard-section-head" style={{ marginBottom: 22 }}>
        <div>
          <h2>{t('dashboard.teamCommand.title')}</h2>
          <p className="page-subtitle" style={{ marginTop: 8, marginBottom: 0 }}>
            {t('dashboard.teamCommand.subtitle')}
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
        <h3 style={{ margin: '0 0 10px' }}>{t('dashboard.teamCommand.overview.title')}</h3>
        <p className="muted" style={{ margin: '0 0 22px', maxWidth: 760, lineHeight: 1.55 }}>
          {t('dashboard.teamCommand.overview.description')}
        </p>

        {!hasMembers ? <p className="muted">{t('dashboard.teamCommand.overview.empty')}</p> : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {safeMembers.map((member) => {
            const expanded = expandedMemberId === member.userId;
            const avatarUrl = avatarUrlFor(member);
            const emailLabel = member.email || t('dashboard.teamCommand.member.noEmailOnFile');
            const summary = memberSummary(member);
            const showStatusPill = shouldShowStatusPill(member);
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
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '16px 24px',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '18px 24px 18px 20px',
                    textAlign: 'left',
                    color: 'var(--text)',
                    overflow: 'visible'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 1 280px' }}>
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
                        {member.role} · {emailLabel}
                      </span>
                    </span>
                  </span>

                  {summary ? (
                    <span style={{ minWidth: 0, overflowWrap: 'anywhere', flex: '1 1 220px' }}>
                      <strong style={{ display: 'block', fontWeight: 500, lineHeight: 1.25 }}>{summary}</strong>
                      {member.nextUpcomingJob ? (
                        <span className="muted" style={{ display: 'block', lineHeight: 1.35, marginTop: 6 }}>
                          {`${t('dashboard.teamCommand.summary.nextPrefix')} ${member.nextUpcomingJob.date}`}
                        </span>
                      ) : null}
                    </span>
                  ) : null}

                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14, flex: '0 0 auto', marginLeft: 'auto' }}>
                    {showStatusPill ? (
                      <span
                        style={{
                          border: '1px solid',
                          borderRadius: 999,
                          padding: '5px 12px',
                          fontSize: 13,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          ...statusTone(member)
                        }}
                      >
                        {statusLabel(member.workloadStatus, member)}
                      </span>
                    ) : null}
                    <span aria-hidden="true" style={{ color: 'var(--muted)', fontSize: 18, flexShrink: 0 }}>
                      {expanded ? '−' : '+'}
                    </span>
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
                      {smallMetric(t('dashboard.teamCommand.member.active'), member.activeJobs)}
                      {smallMetric(t('dashboard.teamCommand.member.dueToday'), member.dueTodayJobs)}
                      {smallMetric(t('dashboard.teamCommand.member.overdue'), member.overdueJobs)}
                      {smallMetric(t('dashboard.teamCommand.member.completed'), member.completedJobs)}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
                      <div>
                        <strong style={{ display: 'block', color: 'var(--charcoal)' }}>
                          {t('dashboard.teamCommand.member.nextAssignment')}
                        </strong>
                        {member.nextUpcomingJob ? (
                          <p className="muted" style={{ margin: '4px 0 0' }}>
                            <Link href={`/jobs/${member.nextUpcomingJob.id}`}>{member.nextUpcomingJob.title}</Link> · {member.nextUpcomingJob.date}
                          </p>
                        ) : (
                          <p className="muted" style={{ margin: '4px 0 0' }}>
                            {t('dashboard.teamCommand.member.noScheduledAssignment')}
                          </p>
                        )}
                      </div>
                      <div>
                        <strong style={{ display: 'block', color: 'var(--charcoal)' }}>{t('dashboard.teamCommand.member.contact')}</strong>
                        <p className="muted" style={{ margin: '4px 0 0', overflowWrap: 'anywhere' }}>
                          {emailLabel}
                        </p>
                      </div>
                    </div>

                    <div className="team-command-member-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <Link className="btn btn-sm" href={`/schedule?member=${member.userId}`}>
                        {t('dashboard.teamCommand.member.viewSchedule')}
                      </Link>
                      <Link className="btn btn-sm" href={`/jobs?assigned_to=${member.userId}`}>
                        {t('dashboard.teamCommand.member.viewJobs')}
                      </Link>
                      <Link className="btn btn-sm btn-primary" href={`/jobs/new?assigned_to=${member.userId}`}>
                        {t('dashboard.teamCommand.member.assignJob')}
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
