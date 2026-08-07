'use client';

import Link from 'next/link';
import { LanguageSwitcher } from '@/components/language-switcher';
import { BrandLogo } from '@/components/brand-logo';
import { useTranslation } from '@/components/locale-provider';
import type { UserRole } from '@/lib/roles';

type OnboardingShellProps = {
  role?: UserRole | string | null;
  children: React.ReactNode;
};

export function OnboardingShell({ children }: OnboardingShellProps) {
  return (
    <div className="onboarding-layout">
      <header className="onboarding-header">
        <BrandLogo href="/dashboard" showName />
        <div className="onboarding-header-actions">
          <LanguageSwitcher />
        </div>
      </header>
      <main id="main-content" className="onboarding-main">
        <div className="onboarding-content">{children}</div>
      </main>
    </div>
  );
}

export function OnboardingCard({
  children,
  stepLabel
}: {
  children: React.ReactNode;
  stepLabel?: string;
}) {
  return (
    <article className="card onboarding-card">
      {stepLabel ? <p className="onboarding-step-label">{stepLabel}</p> : null}
      {children}
    </article>
  );
}

export function OnboardingActions({
  onContinue,
  onSkipThisStep,
  onSkipAll,
  onCancel,
  onBack,
  continueLabel,
  skipThisStepLabel,
  skipAllLabel,
  cancelLabel,
  backLabel,
  busy,
  continueDisabled,
  showSkipThisStep = true
}: {
  onContinue: () => void;
  onSkipThisStep?: () => void;
  onSkipAll?: () => void;
  onCancel?: () => void;
  onBack?: () => void;
  continueLabel: string;
  skipThisStepLabel: string;
  skipAllLabel: string;
  cancelLabel: string;
  backLabel?: string;
  busy?: boolean;
  continueDisabled?: boolean;
  showSkipThisStep?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="onboarding-actions">
      {onBack ? (
        <button type="button" className="btn onboarding-back" onClick={onBack} disabled={busy}>
          {backLabel || t('common.back')}
        </button>
      ) : null}
      <button type="button" className="btn btn-primary onboarding-continue" onClick={onContinue} disabled={busy || continueDisabled}>
        {continueLabel}
      </button>
      {showSkipThisStep && onSkipThisStep ? (
        <button type="button" className="btn onboarding-skip-step" onClick={onSkipThisStep} disabled={busy}>
          {skipThisStepLabel}
        </button>
      ) : null}
      {onSkipAll ? (
        <button type="button" className="btn onboarding-exit-action" onClick={onSkipAll} disabled={busy}>
          {skipAllLabel}
        </button>
      ) : null}
      {onCancel ? (
        <button type="button" className="btn onboarding-exit-action onboarding-cancel" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
      ) : null}
    </div>
  );
}

export function OnboardingExploreLink({ href = '/jobs' }: { href?: string }) {
  const { t } = useTranslation();
  return (
    <Link href={href} className="btn">
      {t('common.exploreFeatures')}
    </Link>
  );
}
