'use client';

import { useEffect, useState } from 'react';

const TIMEOUT_MS = 12000;

export function ContractorLoadingGuard() {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const pageText = document.body.textContent || '';
      if (/Loading\.\.\.|Loading…/i.test(pageText)) setTimedOut(true);
    }, TIMEOUT_MS);

    return () => window.clearTimeout(timer);
  }, []);

  if (!timedOut) return null;

  return (
    <div
      role="alert"
      className="card"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 24,
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: 'min(92vw, 560px)',
        padding: 18,
        boxShadow: '0 18px 50px rgba(15, 23, 42, 0.18)'
      }}
    >
      <strong>The contractor dashboard is taking too long to load.</strong>
      <p className="muted" style={{ margin: '8px 0 12px' }}>
        Your jobs and payment records were not changed. Try loading the page again.
      </p>
      <div className="button-row">
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Try again
        </button>
        <a className="btn" href="/portal/contractor/settings">
          Open settings
        </a>
      </div>
    </div>
  );
}
