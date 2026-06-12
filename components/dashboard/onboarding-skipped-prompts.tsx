'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';

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

  const links: { show: boolean; href: string; label: string }[] = [
    { show: jobsCount === 0, href: '#new-job', label: t('dashboard.skipped.createJob') },
    { show: customersCount === 0, href: '/customers', label: t('dashboard.skipped.addCustomer') },
    { show: teamManagementEnabled && teamMembers <= 1, href: '/settings/team', label: t('dashboard.skipped.inviteTeam') },
    {
      show: calendarConfigured && !calendarConnected,
      href: '/settings/integrations',
      label: t('dashboard.skipped.connectCalendar')
    }
  ];

  const visible = links.filter((item) => item.show);
  if (visible.length === 0) return null;

  return (
    <p className="dashboard-skipped-inline">
      <span>{t('dashboard.skipped.label')}</span>
      {visible.map((item, index) => (
        <span key={item.href}>
          {index > 0 ? ' · ' : ' '}
          <Link href={item.href}>{item.label}</Link>
        </span>
      ))}
    </p>
  );
}
