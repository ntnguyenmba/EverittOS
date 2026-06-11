'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import {
  ONBOARDING_STEP_COUNT,
  onboardingDismissStorageKey,
  onboardingProgressPercent
} from '@/lib/onboarding/constants';

type OnboardingChecklistProps = {
  organizationId: string;
  step: number;
  completed: boolean;
  skipped?: boolean;
};

export function OnboardingChecklist({ organizationId, step, completed, skipped }: OnboardingChecklistProps) {
  const { t, messages } = useTranslation();
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

  if (completed || skipped || dismissed) {
    return null;
  }

  const progress = onboardingProgressPercent(step, completed);
  const steps = messages.onboarding.checklist.steps;

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
          <h3>{t('onboarding.checklist.title')}</h3>
          <p className="muted">{t('onboarding.checklist.description')}</p>
        </div>
        <button type="button" className="btn" onClick={dismiss} aria-label={t('onboarding.checklist.dismiss')}>
          {t('onboarding.checklist.dismiss')}
        </button>
      </div>
      <div className="onboarding-progress">
        <div className="onboarding-progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <ol className="onboarding-checklist-steps">
        {(steps as string[]).slice(0, ONBOARDING_STEP_COUNT).map((label: string, index: number) => {
          const done = completed || index < step;
          return (
            <li key={label} className={done ? 'done' : undefined}>
              {done ? '✓ ' : ''}
              {label}
            </li>
          );
        })}
      </ol>
      <div className="settings-actions" style={{ marginTop: 12 }}>
        <Link href="/onboarding" className="btn btn-primary">
          {t('onboarding.checklist.continue')}
        </Link>
        <Link href="/settings" className="btn">
          {t('onboarding.checklist.settings')}
        </Link>
      </div>
    </div>
  );
}
