'use client';

import { useTranslations } from 'next-intl';

type SessionIdleWarningProps = {
  open: boolean;
  secondsRemaining: number;
  onStaySignedIn: () => void;
};

export function SessionIdleWarning({ open, secondsRemaining, onStaySignedIn }: SessionIdleWarningProps) {
  const t = useTranslations('session');

  if (!open) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeLabel =
    minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : t('seconds', { count: secondsRemaining });

  return (
    <div
      className="session-idle-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-idle-title"
      aria-describedby="session-idle-desc"
    >
      <div className="card session-idle-dialog">
        <h3 id="session-idle-title">{t('expiringTitle')}</h3>
        <p id="session-idle-desc" className="muted">
          {t('expiringBody', { time: timeLabel })}
        </p>
        <div className="inline-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={onStaySignedIn}>
            {t('staySignedIn')}
          </button>
        </div>
      </div>
    </div>
  );
}
