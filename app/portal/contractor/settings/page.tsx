'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';
import { PortalAccountSettings } from '@/components/portal/portal-account-settings';
import { CONTRACTOR_HOME_PATH, CONTRACTOR_SETTINGS_PATH } from '@/lib/contractor-dashboard';
import { performClientLogout } from '@/lib/client-logout';

export default function ContractorPortalSettingsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await performClientLogout();
      window.location.assign('/login');
    } catch {
      router.push('/login');
      setSigningOut(false);
    }
  }

  return (
    <div className="contractor-dashboard">
      <header style={{ marginBottom: 20 }}>
        <p className="muted" style={{ marginBottom: 4 }}>
          {t('portal.contractor.accountLabel')}
        </p>
        <h1>{t('portal.contractor.settingsTitle')}</h1>
        <p className="muted">{t('portal.contractor.settingsDescription')}</p>
        <div className="button-row" style={{ marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
          <Link href={CONTRACTOR_HOME_PATH} className="btn">
            {t('portal.account.backToOverview')}
          </Link>
          <Link href={CONTRACTOR_SETTINGS_PATH} className="btn btn-primary" aria-current="page">
            {t('portal.common.account')}
          </Link>
          <button type="button" className="btn" onClick={() => void signOut()} disabled={signingOut} aria-busy={signingOut}>
            {signingOut ? t('portal.common.signingOut') : t('portal.common.signOut')}
          </button>
        </div>
      </header>

      <PortalAccountSettings variant="contractor" homeHref={CONTRACTOR_HOME_PATH} />
    </div>
  );
}
