import Link from 'next/link';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { AppFooter } from '@/components/app-footer';
import { OrgSwitcher } from '@/components/org-switcher';
import { PortalShellNav } from '@/components/portal/portal-shell-nav';
import { LOCALE_COOKIE_NAME, normalizeLocale } from '@/lib/i18n/config';
import { getContractorLayoutCopy } from '@/lib/i18n/ui-chrome-copy';
import './contractor-minimal.css';

type ContractorLayoutProps = {
  children: ReactNode;
};

export default async function ContractorLayout({ children }: ContractorLayoutProps) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const c = getContractorLayoutCopy(locale);

  const contractorLinks = [
    { href: '/portal/contractor', label: c.dashboard },
    { href: '/portal/contractor#jobs', label: c.jobs },
    { href: '/portal/contractor#schedule', label: c.schedule },
    { href: '/portal/contractor#earnings', label: c.earnings },
    { href: '/portal/contractor/settings', label: c.settings }
  ];

  return (
    <div className="dashboard-shell contractor-dashboard-shell">
      <div className="contractor-background" aria-hidden="true" />

      <div className="dashboard-shell-mobile contractor-mobile-header">
        <Link className="contractor-mobile-brand" href="/portal/contractor">
          EverittOS
        </Link>
        <div className="portal-header-actions">
          <OrgSwitcher />
          <Link className="btn" href="/portal/contractor/settings">
            {c.settings}
          </Link>
        </div>
      </div>

      <aside className="sidebar contractor-sidebar" aria-label={c.navAria}>
        <div className="contractor-sidebar-inner">
          <Link className="contractor-brand" href="/portal/contractor">
            <span className="contractor-brand-mark" aria-hidden="true">E</span>
            <span>
              <strong>EverittOS</strong>
              <small>{c.portalSubtitle}</small>
            </span>
          </Link>

          <OrgSwitcher />

          <PortalShellNav links={contractorLinks} />
        </div>
      </aside>

      <main id="main-content" className="main contractor-main">
        {children}
        <AppFooter />
      </main>
    </div>
  );
}
