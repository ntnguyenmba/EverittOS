'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';
import { performClientLogout } from '@/lib/client-logout';

type PortalClientNavProps = {
  active: 'overview' | 'appointments' | 'account';
  overviewHref: string;
  appointmentsHref: string;
  accountHref: string;
  extraActions?: ReactNode;
};

/** Client navigation is in the shared menu; keep only a compact sign-out action here. */
export function PortalClientNav(_props: PortalClientNavProps) {
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
      router.replace('/login');
      setSigningOut(false);
    }
  }

  return (
    <div className="portal-client-nav">
      <button
        type="button"
        className="btn contractor-signout"
        onClick={() => void signOut()}
        disabled={signingOut}
        aria-busy={signingOut}
      >
        {signingOut ? t('portal.common.signingOut') : t('portal.common.signOut')}
      </button>
    </div>
  );
}
