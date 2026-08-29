'use client';

import { AppBackButton } from '@/components/app-back-button';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { OrgSwitcher } from '@/components/org-switcher';
import { dashboardPathForRole } from '@/lib/dashboard-nav';
import { isClientRole, isContractorRole, normalizeRole } from '@/lib/roles';

type AppPageTopProps = { role?: string | null; showBackButton?: boolean };

export function AppPageTop({ role, showBackButton = true }: AppPageTopProps) {
  const normalizedRole = normalizeRole(role);
  const isFocusedPortal = isClientRole(normalizedRole) || isContractorRole(normalizedRole);
  const homeHref = dashboardPathForRole(normalizedRole);

  if (isFocusedPortal) {
    return (
      <div className="app-page-top app-page-top-portal">
        <BrandLogo href={homeHref} size={36} showName={false} className="app-page-top-logo" />
        <div className="app-page-top-workspace app-page-top-portal-workspace">
          <div className="app-page-top-portal-org">
            <OrgSwitcher />
          </div>
          <div className="app-page-top-language">
            <LanguageSwitcher id={isContractorRole(normalizedRole) ? 'contractor-portal-top-language' : 'client-portal-language'} variant="compact" />
          </div>
        </div>
        <style jsx global>{`
          .app-page-top-portal{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;margin:0 0 14px;padding:0}
          .app-page-top-logo{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:12px;background:#fff;box-shadow:0 8px 24px rgba(9,24,35,.14)}
          .app-page-top-logo .brand-logo-image{display:block;border-radius:8px}
          .app-page-top-portal-workspace{display:grid;grid-template-columns:minmax(160px,1fr) minmax(110px,140px);align-items:center;gap:10px;min-width:0;flex:1}
          .app-page-top-portal-org,.app-page-top-language{min-width:0;width:100%}
          @media(max-width:1279px){.app-page-top-portal{display:flex!important}}
        `}</style>
      </div>
    );
  }

  return (
    <div className={`app-page-top app-page-top-branded${normalizedRole === 'owner' ? ' app-page-top-owner' : ''}`}>
      <BrandLogo href={homeHref} size={36} showName={false} className="app-page-top-logo" />
      <div className="app-page-top-workspace">
        <OrgSwitcher />
        {showBackButton ? (
          <div className="app-page-top-actions">
            <AppBackButton role={role} />
          </div>
        ) : null}
      </div>
      <style jsx global>{`
        .app-page-top-branded{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;margin:0 0 16px;padding:0}
        .app-page-top-logo{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:12px;background:#fff;box-shadow:0 8px 24px rgba(9,24,35,.14)}
        .app-page-top-logo .brand-logo-image{display:block;border-radius:8px}
        .app-page-top-workspace{display:flex;align-items:center;justify-content:flex-end;gap:12px;min-width:0;flex:1}
        .app-page-top-owner .org-switcher{flex:1 1 220px;min-width:0;max-width:280px;margin-left:0}
        .app-page-top-owner .org-switcher-label{display:none}
        @media(max-width:640px){.app-page-top-branded{margin-bottom:14px}.app-page-top-workspace{gap:8px}.app-page-top-owner .org-switcher{max-width:min(220px,calc(100vw - 148px))}}
      `}</style>
    </div>
  );
}
