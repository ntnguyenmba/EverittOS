'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';
import { EmptyState } from '@/components/empty-state';

type OnboardingSkippedPromptsProps = {
  skipped: boolean;
  jobsCount: number;
  customersCount: number;
  teamMembers: number;
  calendarConnected: boolean;
  calendarConfigured: boolean;
  teamManagementEnabled: boolean;
};

export function OnboardingSkippedPrompts({
  skipped,
  jobsCount,
  customersCount,
  teamMembers,
  calendarConnected,
  calendarConfigured,
  teamManagementEnabled
}: OnboardingSkippedPromptsProps) {
  const { t } = useTranslation();

  if (!skipped) return null;

  const prompts: { key: string; show: boolean; href: string; action: string }[] = [
    {
      key: 'firstJob',
      show: jobsCount === 0,
      href: '/dashboard',
      action: t('dashboard.skippedPrompts.createJob')
    },
    {
      key: 'customers',
      show: customersCount === 0,
      href: '/customers',
      action: t('dashboard.skippedPrompts.addCustomer')
    },
    {
      key: 'team',
      show: teamManagementEnabled && teamMembers <= 1,
      href: '/settings/team',
      action: t('dashboard.skippedPrompts.inviteTeam')
    },
    {
      key: 'calendar',
      show: calendarConfigured && !calendarConnected,
      href: '/settings/integrations',
      action: t('dashboard.skippedPrompts.connectCalendar')
    },
  ];

  const visible = prompts.filter((item) => item.show);
  if (visible.length === 0) return null;

  return (
    <section className="card dashboard-skipped-prompts" aria-label={t('dashboard.skippedPrompts.title')}>
      <h3 className="card-title-sm">{t('dashboard.skippedPrompts.title')}</h3>
      <p className="muted">{t('dashboard.skippedPrompts.description')}</p>
      <div className="dashboard-skipped-prompts-grid">
        {visible.map((item) => (
          <div key={item.key} className="dashboard-skipped-prompt-card">
            <EmptyState
              title={t(`dashboard.skippedPrompts.${item.key}.title`)}
              description={t(`dashboard.skippedPrompts.${item.key}.description`)}
              action={
                <Link className="btn btn-sm btn-primary" href={item.href}>
                  {item.action}
                </Link>
              }
            />
          </div>
        ))}
      </div>
      <p className="muted dashboard-skipped-restart-note">
        {t('dashboard.skippedPrompts.restartNote')}{' '}
        <Link href="/settings">{t('dashboard.skippedPrompts.restartSetup')}</Link>
      </p>
    </section>
  );
}
