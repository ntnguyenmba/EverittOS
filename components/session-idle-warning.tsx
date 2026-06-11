'use client';

type SessionIdleWarningProps = {
  open: boolean;
  secondsRemaining: number;
  onStaySignedIn: () => void;
};

export function SessionIdleWarning({ open, secondsRemaining, onStaySignedIn }: SessionIdleWarningProps) {
  if (!open) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeLabel =
    minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${secondsRemaining} seconds`;

  return (
    <div
      className="session-idle-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-idle-title"
      aria-describedby="session-idle-desc"
    >
      <div className="card session-idle-dialog">
        <h3 id="session-idle-title">Session expiring soon</h3>
        <p id="session-idle-desc" className="muted">
          You will be signed out in {timeLabel} due to inactivity. Move your mouse, type, or tap Stay signed in to
          continue working.
        </p>
        <div className="inline-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={onStaySignedIn}>
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
