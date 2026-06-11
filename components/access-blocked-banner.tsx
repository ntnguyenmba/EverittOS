'use client';

import { useState } from 'react';

type AccessBlockedBannerProps = {
  title: string;
  message: string;
  details?: string;
  actionHref?: string;
  actionLabel?: string;
};

export function AccessBlockedBanner({
  title,
  message,
  details,
  actionHref,
  actionLabel = 'Open billing'
}: AccessBlockedBannerProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="access-blocked-banner" role="alert">
      <strong>{title}</strong>
      <p>{message}</p>
      <div className="access-blocked-actions">
        {actionHref ? (
          <a className="btn btn-primary" href={actionHref}>
            {actionLabel}
          </a>
        ) : null}
        {details ? (
          <button type="button" className="btn" onClick={() => setShowDetails((open) => !open)}>
            {showDetails ? 'Hide details' : 'Details'}
          </button>
        ) : null}
      </div>
      {showDetails && details ? <pre className="auth-message-details">{details}</pre> : null}
    </div>
  );
}
