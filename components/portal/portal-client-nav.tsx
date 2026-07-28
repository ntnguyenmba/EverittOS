'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';
import { performClientLogout } from '@/lib/client-logout';

type PortalClientNavProps = {
  active: 'overview' | 'appointments' | 'account';
  overviewHref: string;
  appointmentsHref: string;
  accountHref: string;
  /** Extra tab buttons rendered before Account/Sign out (client dashboard tabs). */
  extraActions?: React.ReactNode;
};

/** Shared client portal navigation with a visible Sign Out on every screen. */
export function PortalClientNav({
  active,
  overviewHref,
  appointmentsHref,
  accountHref,
  extraActions
}: PortalClientNavProps) {
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
    <nav className="inline-actions" style={{ marginBottom: 16, flexWrap: 'wrap' }} aria-label={t('portal.common.sections')}>
      {extraActions}
      {!extraActions ? (
        <>
          <Link href={overviewHref} className={active === 'overview' ? 'btn btn-primary' : 'btn'} aria-current={active === 'overview' ? 'page' : undefined}>
            {t('portal.common.overview')}
          </Link>
          <Link
            href={appointmentsHref}
            className={active === 'appointments' ? 'btn btn-primary' : 'btn'}
            aria-current={active === 'appointments' ? 'page' : undefined}
          >
            {t('portal.common.appointments')}
          </Link>
        </>
      ) : null}
      <Link href={accountHref} className={active === 'account' ? 'btn btn-primary' : 'btn'} aria-current={active === 'account' ? 'page' : undefined}>
        {t('portal.common.account')}
      </Link>
      <button type="button" className="btn" onClick={() => void signOut()} disabled={signingOut} aria-busy={signingOut}>
        {signingOut ? t('portal.common.signingOut') : t('portal.common.signOut')}
      </button>
    </nav>
  );
}
