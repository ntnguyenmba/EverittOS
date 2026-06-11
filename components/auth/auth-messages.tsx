'use client';

import { useState } from 'react';

type AuthMessagesProps = {
  error?: string | null;
  errorTitle?: string | null;
  errorDetails?: string | null;
  success?: string | null;
};

export function AuthMessages({ error, errorTitle, errorDetails, success }: AuthMessagesProps) {
  const [showDetails, setShowDetails] = useState(false);
  const details = errorDetails || error;

  return (
    <>
      {error ? (
        <div className="auth-message auth-message-error" role="alert">
          {errorTitle ? <strong className="auth-message-title">{errorTitle}</strong> : null}
          <p className="auth-message-body">{error}</p>
          {details && details !== error ? (
            <>
              <button
                type="button"
                className="auth-message-details-toggle"
                onClick={() => setShowDetails((open) => !open)}
                aria-expanded={showDetails}
              >
                {showDetails ? 'Hide details' : 'Details'}
              </button>
              {showDetails ? (
                <pre className="auth-message-details">{details}</pre>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
      {success ? <p className="auth-message auth-message-success">{success}</p> : null}
    </>
  );
}
