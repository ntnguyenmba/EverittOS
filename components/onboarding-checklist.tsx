'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ONBOARDING_STEP_LABELS,
  onboardingDismissStorageKey,
  onboardingProgressPercent
} from '@/lib/onboarding-checklist';

type OnboardingChecklistProps = {
  organizationId: string;
  step: number;
  completed: boolean;
};

const STEP_KEYS = [
  'onboarding.steps.workspace',
  'onboarding.steps.customer',
  'onboarding.steps.job',
  'onboarding.steps.photo',
  'onboarding.steps.report',
  'onboarding.steps.invite'
] as const;

export function OnboardingChecklist({ organizationId, step, completed }: OnboardingChecklistProps) {
  const t = useTranslations();
  const commonT = useTranslations('common');
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!organizationId) return;
    try {
      const stored = localStorage.getItem(onboardingDismissStorageKey(organizationId));
      setDismissed(stored === '1');
    } catch {
      setDismissed(false);
    }
  }, [organizationId]);

  if (completed || dismissed) {
    return null;
  }

  const progress = onboardingProgressPercent(step, completed);

  function dismiss() {
    try {
      localStorage.setItem(onboardingDismissStorageKey(organizationId), '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  return (
    <div className="card onboarding-checklist" style={{ marginTop: 18 }}>
      <div className="onboarding-checklist-head">
        <div>
          <h3>{t('onboarding.gettingStarted')}</h3>
          <p className="muted">{t('onboarding.gettingStartedBody')}</p>
        </div>
        <button type="button" className="btn" onClick={dismiss} aria-label={t('onboarding.dismissChecklist')}>
          {commonT('dismiss')}
        </button>
      </div>
      <div className="onboarding-progress">
        <div className="onboarding-progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <ol className="onboarding-checklist-steps">
        {ONBOARDING_STEP_LABELS.map((_, index) => {
          const done = completed || index < step;
          const label = t(STEP_KEYS[index]);
          return (
            <li key={STEP_KEYS[index]} className={done ? 'done' : undefined}>
              {done ? '✓ ' : ''}
              {label}
            </li>
          );
        })}
      </ol>
      <div className="settings-actions" style={{ marginTop: 12 }}>
        <Link href="/onboarding" className="btn btn-primary">
          {t('onboarding.continueSetup')}
        </Link>
        <Link href="/settings" className="btn">
          {t('onboarding.workspaceSettings')}
        </Link>
      </div>
    </div>
  );
}
