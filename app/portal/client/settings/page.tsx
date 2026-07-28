'use client';

import { AuthenticatedSection } from '@/components/authenticated-section';
import { useTranslation } from '@/components/locale-provider';
import { PortalAccountSettings } from '@/components/portal/portal-account-settings';
import { PortalClientNav } from '@/components/portal/portal-client-nav';
import { CLIENT_HOME_PATH, CLIENT_SETTINGS_PATH } from '@/lib/client-portal';
import { clientPortalJobsPath } from '@/lib/portal-access';

export default function ClientPortalSettingsPage() {
  const { t } = useTranslation();

  return (
    <AuthenticatedSection role="client">
      <header style={{ marginBottom: 20 }}>
        <p className="muted" style={{ marginBottom: 4 }}>
          {t('portal.client.portal')}
        </p>
        <h1>{t('portal.client.settingsTitle')}</h1>
        <p className="muted">{t('portal.client.settingsDescription')}</p>
      </header>

      <PortalClientNav
        active="account"
        overviewHref={CLIENT_HOME_PATH}
        appointmentsHref={clientPortalJobsPath()}
        accountHref={CLIENT_SETTINGS_PATH}
      />

      <PortalAccountSettings variant="client" homeHref={CLIENT_HOME_PATH} />
    </AuthenticatedSection>
  );
}
