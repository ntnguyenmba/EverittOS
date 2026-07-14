'use client';

import Link from 'next/link';
import { minimumAiUpgradePlan, plansWithEverittAi } from '@/lib/billing-config';
import { resolveBillingVisibility } from '@/lib/platform/billing';

type AiUpgradeModalProps = {
  open: boolean;
  onClose: () => void;
  plan?: string;
};

export function AiUpgradeModal({ open, onClose, plan }: AiUpgradeModalProps) {
  if (!open) return null;

  const billingVisibility = resolveBillingVisibility();
  const upgradePlan = plan || minimumAiUpgradePlan();
  const aiPlans = plansWithEverittAi()
    .map((tier) => tier.replace(/^./, (c) => c.toUpperCase()))
    .join(', ');

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
          {billingVisibility.surface === 'native'
            ? 'Ask Everitt search is available. Everitt AI writing, summarizing, and analysis are not available on your current plan in this app.'
            : (
                <>
                  Ask Everitt search is included on every plan. Everitt AI writing, summarizing, and analysis is available on{' '}
                  {aiPlans} plans.
                </>
              )}
        </p>
        <div className="ai-modal-actions">
          {billingVisibility.showUpgradeActions ? (
            <Link
              className="btn btn-primary"
              href={`/settings/billing?upgrade=${upgradePlan}&reason=ai`}
              onClick={onClose}
            >
              View plans
            </Link>
          ) : null}
          <button type="button" className={billingVisibility.showUpgradeActions ? 'btn' : 'btn btn-primary'} onClick={onClose}>
            {billingVisibility.showUpgradeActions ? 'Not now' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
