'use client';

import Link from 'next/link';

type AiUpgradeModalProps = {
  open: boolean;
  onClose: () => void;
  plan?: string;
};

export function AiUpgradeModal({ open, onClose, plan = 'business' }: AiUpgradeModalProps) {
  if (!open) return null;

  return (
    <div className="ai-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="ai-modal-card"
        role="dialog"
        aria-labelledby="ai-upgrade-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="ai-upgrade-title">Everitt AI</h2>
        <p className="muted">
          Ask Everitt search is included on every plan. Everitt AI writing, summarizing, and analysis is available on
          Business and Enterprise plans.
        </p>
        <div className="ai-modal-actions">
          <Link className="btn btn-primary" href={`/settings/billing?upgrade=${plan}&reason=ai`} onClick={onClose}>
            View plans
          </Link>
          <button type="button" className="btn" onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
