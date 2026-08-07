'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';
import { getAiUpgradeCopy } from '@/lib/i18n/ui-chrome-copy';
import { resolveBillingVisibility } from '@/lib/platform/billing';

type AiUpgradeModalProps = {
  open: boolean;
  onClose: () => void;
  plan?: string;
};

export function AiUpgradeModal({ open, onClose, plan }: AiUpgradeModalProps) {
  const { locale } = useTranslation();
  const c = getAiUpgradeCopy(locale);

  if (!open) return null;

  const billingVisibility = resolveBillingVisibility();

  // Native shells must never show plan upsells or purchase links.
  if (billingVisibility.surface === 'native') {
    return (
      <div className="ai-modal-overlay" role="presentation" onClick={onClose}>
        <div
          className="ai-modal-card"
          role="dialog"
          aria-labelledby="ai-unavailable-title"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="ai-unavailable-title">{c.askEveritt}</h2>
          <p className="muted">{c.unavailable}</p>
          <div className="ai-modal-actions">
            <button type="button" className="btn btn-primary" onClick={onClose}>
              {c.close}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const upgradePlan = plan || 'business';

  return (
    <div className="ai-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="ai-modal-card"
        role="dialog"
        aria-labelledby="ai-upgrade-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="ai-upgrade-title">{c.everittAi}</h2>
        <p className="muted">{c.body}</p>
        <div className="ai-modal-actions">
          {billingVisibility.showUpgradeActions ? (
            <Link
              className="btn btn-primary"
              href={`/settings/billing?upgrade=${upgradePlan}&reason=ai`}
              onClick={onClose}
            >
              {c.viewPlans}
            </Link>
          ) : null}
          <button type="button" className={billingVisibility.showUpgradeActions ? 'btn' : 'btn btn-primary'} onClick={onClose}>
            {billingVisibility.showUpgradeActions ? c.notNow : c.close}
          </button>
        </div>
      </div>
    </div>
  );
}
