'use client';

import { GoToDashboardLink } from '@/components/go-to-dashboard-link';
import { useTranslation } from '@/components/locale-provider';
import { getPermissionDeniedCopy } from '@/lib/i18n/ui-chrome-copy';

type PermissionDeniedProps = {
  message?: string;
  role?: string | null;
};

export function PermissionDenied({ message, role }: PermissionDeniedProps) {
  const { locale, t } = useTranslation();
  const c = getPermissionDeniedCopy(locale);

  return (
    <div className="card permission-denied">
      <h3>{c.title}</h3>
      <p className="muted">{message ?? c.defaultMessage}</p>
      <GoToDashboardLink role={role} className="btn">
        {t('common.goToDashboard')}
      </GoToDashboardLink>
    </div>
  );
}
