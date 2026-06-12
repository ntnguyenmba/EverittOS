'use client';

import { useTranslation } from '@/components/locale-provider';
import { onboardingCallMailtoHref } from '@/lib/support';

export type OnboardingSupportVariant = 'pricing' | 'welcome' | 'dashboard' | 'settings';

type OnboardingSupportPromoProps = {
  variant: OnboardingSupportVariant;
  className?: string;
};

export function OnboardingSupportPromo({ variant, className = '' }: OnboardingSupportPromoProps) {
  const { t } = useTranslation();
  const href = onboardingCallMailtoHref();

  const items = [
    t('supportTraining.itemOnboardingCall'),
    t('supportTraining.itemSopSetup'),
    t('supportTraining.itemTeamTraining')
  ];

  if (variant === 'welcome') {
    return (
      <section
        className={`onboarding-support-card onboarding-support-card-welcome ${className}`.trim()}
        aria-label={t('supportTraining.welcomeTitle')}
      >
        <h3 className="onboarding-support-title">{t('supportTraining.welcomeTitle')}</h3>
        <p className="onboarding-support-body">{t('supportTraining.welcomeBody')}</p>
        <a className="btn btn-primary onboarding-support-cta" href={href}>
          {t('supportTraining.bookOnboardingCall')}
        </a>
      </section>
    );
  }

  if (variant === 'dashboard') {
    return (
      <section
        className={`onboarding-support-card onboarding-support-card-dashboard onboarding-support-card-dashboard-subtle ${className}`.trim()}
        aria-label={t('supportTraining.dashboardTitle')}
      >
        <div className="onboarding-support-dashboard-inner">
          <div>
            <h2 className="onboarding-support-title">{t('supportTraining.dashboardTitle')}</h2>
            <p className="muted onboarding-support-body">{t('supportTraining.dashboardBody')}</p>
          </div>
          <a className="btn onboarding-support-cta onboarding-support-cta-subtle" href={href}>
            {t('supportTraining.bookFreeCall')}
          </a>
        </div>
      </section>
    );
  }

  if (variant === 'settings') {
    return (
      <div className={`settings-card onboarding-support-card onboarding-support-card-settings ${className}`.trim()}>
        <ul className="onboarding-support-list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <a className="btn btn-primary onboarding-support-cta" href={href}>
          {t('supportTraining.contactEverittTeam')}
        </a>
      </div>
    );
  }

  return (
    <section
      className={`card onboarding-support-card onboarding-support-card-pricing ${className}`.trim()}
      aria-label={t('supportTraining.pricingHeadline')}
    >
      <h2 className="onboarding-support-title">{t('supportTraining.pricingHeadline')}</h2>
      <p className="muted onboarding-support-body">{t('supportTraining.pricingBody')}</p>
      <ul className="onboarding-support-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <a className="btn btn-primary onboarding-support-cta" href={href}>
        {t('supportTraining.bookOnboardingCall')}
      </a>
    </section>
  );
}
