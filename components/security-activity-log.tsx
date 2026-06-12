'use client';

import { securityEventLabel, summarizeUserAgent } from '@/lib/security-events';

export type SecurityEventRow = {
  id: string;
  event_type: string;
  severity: string;
  message: string;
  created_at: string;
  user_agent?: string | null;
  ip_address?: string | null;
};

type SecurityActivityLogProps = {
  events: SecurityEventRow[];
  emptyLabel?: string;
};

export function SecurityActivityLog({
  events,
  emptyLabel = 'No security events recorded yet.'
}: SecurityActivityLogProps) {
  if (events.length === 0) {
    return <p className="muted">{emptyLabel}</p>;
  }

  const lastLogin = events.find((e) => e.event_type === 'login_success');

  return (
    <div className="security-activity-log">
      {lastLogin ? (
        <p className="security-last-login">
          <span className="muted">Last sign-in:</span>{' '}
          {new Date(lastLogin.created_at).toLocaleString()} · {summarizeUserAgent(lastLogin.user_agent)}
        </p>
      ) : null}
      <div className="security-event-list">
        {events.map((event) => (
          <div key={event.id} className="security-event-row">
            <div className="security-event-copy">
              <strong>{securityEventLabel(event.event_type)}</strong>
              <span className="muted">{event.message}</span>
            </div>
            <div className="security-event-meta muted">
              <span>{new Date(event.created_at).toLocaleString()}</span>
              <span>{summarizeUserAgent(event.user_agent)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
