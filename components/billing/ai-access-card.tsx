'use client';

import Link from 'next/link';
import { AI_REQUIRED_PLAN, planHasAiAccess } from '@/lib/ai-features';
import { planDisplayName, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { useTranslation } from '@/components/locale-provider';

type AiAccessCardProps = {
  plan: EverittosPlan | string;
  canViewAdminUsage?: boolean;
};

export function AiAccessCard({ plan: planProp, canViewAdminUsage = false }: AiAccessCardProps) {
  const { t } = useTranslation();
  const plan = normalizePlan(planProp);
  const hasEverittAi = planHasAiAccess(plan);

  return (
    <div className="settings-card ai-access-card">
      <h3>{t('billing.aiAccess.title')}</h3>
      <ul className="ai-access-list muted">
        <li>{t('billing.aiAccess.askEverittIncluded')}</li>
        <li>{t('billing.aiAccess.everittAiPlans')}</li>
      </ul>
      {hasEverittAi ? (
        <p className="muted">{t('billing.aiAccess.includedOnPlan', { plan: planDisplayName(plan) })}</p>
      ) : (
        <div className="settings-actions" style={{ marginTop: 12 }}>
          <Link
            className="btn btn-primary"
            href={`/settings/billing?upgrade=${AI_REQUIRED_PLAN}&reason=ai`}
          >
            {t('billing.aiAccess.upgradeCta')}
          </Link>
        </div>
      )}
      {canViewAdminUsage ? (
        <p className="muted" style={{ marginTop: 12 }}>
          <Link href="/settings/ai-usage">{t('billing.aiAccess.viewUsageLink')}</Link>
        </p>
      ) : null}
    </div>
  );
}
