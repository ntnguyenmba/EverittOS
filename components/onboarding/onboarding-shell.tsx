'use client';

import Link from 'next/link';
import { LanguageSwitcher } from '@/components/language-switcher';
import { GoToDashboardLink } from '@/components/go-to-dashboard-link';
import { BrandLogo } from '@/components/brand-logo';
import { useTranslation } from '@/components/locale-provider';
import type { UserRole } from '@/lib/roles';

type OnboardingShellProps = {
  role?: UserRole | string | null;
  children: React.ReactNode;
  onSkipAll?: () => void;
  skipBusy?: boolean;
};

export function OnboardingShell({ role, children, onSkipAll, skipBusy }: OnboardingShellProps) {
  const { t } = useTranslation();

  return (
    <div className="onboarding-layout">
      <header className="onboarding-header">
        <BrandLogo href="/dashboard" showName />
        <div className="onboarding-header-actions">
          <LanguageSwitcher />
          {onSkipAll ? (
            <button type="button" className="btn onboarding-skip-all" onClick={onSkipAll} disabled={skipBusy}>
              {t('onboarding.skipEntire')}
            </button>
          ) : null}
          <GoToDashboardLink role={role} className="btn">
            {t('common.goToDashboard')}
          </GoToDashboardLink>
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
  onSkip,
  onBack,
  continueLabel,
  skipLabel,
  backLabel,
  busy,
  continueDisabled
}: {
  onContinue: () => void;
  onSkip: () => void;
  onBack?: () => void;
  continueLabel: string;
  skipLabel: string;
  backLabel?: string;
  busy?: boolean;
  continueDisabled?: boolean;
}) {
  return (
    <div className="onboarding-actions">
      {onBack ? (
        <button type="button" className="btn onboarding-back" onClick={onBack} disabled={busy}>
          {backLabel || 'Back'}
        </button>
      ) : null}
      <button type="button" className="btn btn-primary" onClick={onContinue} disabled={busy || continueDisabled}>
        {continueLabel}
      </button>
      <button type="button" className="btn" onClick={onSkip} disabled={busy}>
        {skipLabel}
      </button>
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
