'use client';

import { useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { getAccessBlockedCopy } from '@/lib/i18n/ui-chrome-copy';

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
  actionLabel
}: AccessBlockedBannerProps) {
  const { locale } = useTranslation();
  const c = getAccessBlockedCopy(locale);
  const [showDetails, setShowDetails] = useState(false);
  const resolvedActionLabel = actionLabel ?? c.openBilling;

  return (
    <div className="access-blocked-banner" role="alert">
      <strong>{title}</strong>
      <p>{message}</p>
      <div className="access-blocked-actions">
        {actionHref ? (
          <a className="btn btn-primary" href={actionHref}>
            {resolvedActionLabel}
          </a>
        ) : null}
        {details ? (
          <button type="button" className="btn" onClick={() => setShowDetails((open) => !open)}>
            {showDetails ? c.hideDetails : c.details}
          </button>
        ) : null}
      </div>
      {showDetails && details ? <pre className="auth-message-details">{details}</pre> : null}
    </div>
  );
}
