'use client';

import { AppBackButton } from '@/components/app-back-button';
import { AppHomeButton } from '@/components/app-home-button';
import { BrandLogo } from '@/components/brand-logo';
import { dashboardPathForRole } from '@/lib/dashboard-nav';
import { isClientRole, isContractorRole, normalizeRole } from '@/lib/roles';

type AppPageTopProps = { role?: string | null; showBackButton?: boolean };

export function AppPageTop({ role, showBackButton = true }: AppPageTopProps) {
  const normalizedRole = normalizeRole(role);
  const isFocusedPortal = isClientRole(normalizedRole) || isContractorRole(normalizedRole);
  const homeHref = dashboardPathForRole(normalizedRole);

  return (
    <div className={`app-page-top app-page-top-branded${normalizedRole === 'owner' ? ' app-page-top-owner' : ''}${isFocusedPortal ? ' app-page-top-portal' : ''}`}>
      <div className="app-page-top-lead">
        <BrandLogo href={homeHref} size={36} showName={false} className="app-page-top-logo" />
        <AppHomeButton role={normalizedRole} />
        {showBackButton ? <AppBackButton role={role} /> : null}
      </div>
      <style jsx global>{`
        .app-page-top-branded{display:flex;align-items:center;justify-content:flex-start;gap:10px;width:100%;margin:0 0 16px;padding:0;flex-wrap:wrap}
        .app-page-top-lead{display:flex;align-items:center;gap:8px;min-width:0}
        .app-page-top-logo{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:var(--eo-radius-control);background:var(--eo-color-surface);box-shadow:0 8px 24px rgba(9,24,35,.14)}
        .app-page-top-logo .brand-logo-image{display:block;border-radius:8px}
        .app-home-button{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 14px;border-radius:var(--eo-radius-control);background:var(--eo-color-surface);color:var(--eo-color-text);font-size:14px;font-weight:600;text-decoration:none;box-shadow:0 8px 24px rgba(9,24,35,.14)}
        .app-home-button.is-current{background:var(--eo-color-brand);color:var(--eo-color-on-brand)}
        @media(max-width:1279px){.app-page-top-logo{display:none!important}}
        @media(max-width:640px){.app-page-top-branded{margin-bottom:14px}}
      `}</style>
    </div>
  );
}
