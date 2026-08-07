'use client';

import { useTranslation } from '@/components/locale-provider';
import { getSessionIdleCopy } from '@/lib/i18n/ui-chrome-copy';

type SessionIdleWarningProps = {
  open: boolean;
  secondsRemaining: number;
  onStaySignedIn: () => void;
};

export function SessionIdleWarning({ open, secondsRemaining: _secondsRemaining, onStaySignedIn }: SessionIdleWarningProps) {
  const { locale } = useTranslation();
  const c = getSessionIdleCopy(locale);

  if (!open) return null;

  return (
    <div
      className="session-idle-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-idle-title"
      aria-describedby="session-idle-desc"
    >
      <div className="card session-idle-dialog">
        <h3 id="session-idle-title">{c.title}</h3>
        <p id="session-idle-desc" className="muted">
          {c.body}
        </p>
        <div className="inline-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={onStaySignedIn}>
            {c.staySignedIn}
          </button>
        </div>
      </div>
    </div>
  );
}
