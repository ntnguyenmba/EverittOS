'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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

export function OnboardingChecklist({ organizationId, step, completed }: OnboardingChecklistProps) {
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
          <h3>Getting started</h3>
          <p className="muted">
            A quick, optional walkthrough for freelancers, solo operators, and small teams. Finish anytime from
            Settings — nothing here blocks your work.
          </p>
        </div>
        <button type="button" className="btn" onClick={dismiss} aria-label="Dismiss getting started checklist">
          Dismiss
        </button>
      </div>
      <div className="onboarding-progress">
        <div className="onboarding-progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <ol className="onboarding-checklist-steps">
        {ONBOARDING_STEP_LABELS.map((label, index) => {
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
          Continue setup
        </Link>
        <Link href="/settings" className="btn">
          Workspace settings
        </Link>
      </div>
    </div>
  );
}
