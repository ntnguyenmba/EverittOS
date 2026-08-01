'use client';

import { AppBackButton } from '@/components/app-back-button';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { OrgSwitcher } from '@/components/org-switcher';
import { dashboardPathForRole } from '@/lib/dashboard-nav';
import { isClientRole, isContractorRole, normalizeRole } from '@/lib/roles';

type AppPageTopProps = {
  role?: string | null;
  showBackButton?: boolean;
};

/** Shared top row for branding, workspace switching, and contextual navigation. */
export function AppPageTop({ role, showBackButton = true }: AppPageTopProps) {
  const normalizedRole = normalizeRole(role);
  const homeHref = dashboardPathForRole(normalizedRole);
  const isFocusedPortal = isClientRole(normalizedRole) || isContractorRole(normalizedRole);

  // Customer and contractor portals are focused one-page dashboards. They do not
  // need workspace switching or a back button, but language remains easy to reach.
  if (isFocusedPortal) {
    return (
      <div className="app-page-top app-page-top-branded">
        <BrandLogo href={homeHref} size={34} showName className="app-page-brand" />
        <div className="app-page-top-language">
          <LanguageSwitcher
            id={isContractorRole(normalizedRole) ? 'contractor-portal-top-language' : 'client-portal-language'}
            variant="compact"
          />
        </div>

        <style jsx global>{`
          .app-page-top-branded {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            width: 100%;
            margin: 0 0 20px;
            padding: 0;
          }

          .app-page-brand {
            min-width: 0;
            gap: 10px;
          }

          .app-page-brand .brand-logo-image {
            width: 34px;
            height: 34px;
            border-radius: 9px;
          }

          .app-page-brand .brand-logo-name {
            font-size: 20px;
            font-weight: 650;
            letter-spacing: -0.025em;
          }

          .app-page-top-language {
            width: min(100%, 8.75rem);
            margin-left: auto;
          }

          @media (max-width: 640px) {
            .app-page-top-branded {
              margin-bottom: 14px;
            }

            .app-page-brand .brand-logo-image {
              width: 30px;
              height: 30px;
            }

            .app-page-brand .brand-logo-name {
              font-size: 18px;
            }

            .app-page-top-language {
              width: 8.25rem;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="app-page-top app-page-top-branded">
      <BrandLogo href={homeHref} size={34} showName className="app-page-brand" />
      <div className="app-page-top-workspace">
        <OrgSwitcher />
        {showBackButton ? (
          <div className="app-page-top-actions">
            <AppBackButton role={role} />
          </div>
        ) : null}
      </div>

      <style jsx global>{`
        .app-page-top-branded {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          width: 100%;
          margin: 0 0 20px;
          padding: 0;
        }

        .app-page-brand {
          min-width: 0;
          gap: 10px;
        }

        .app-page-brand .brand-logo-image {
          width: 34px;
          height: 34px;
          border-radius: 9px;
        }

        .app-page-brand .brand-logo-name {
          font-size: 20px;
          font-weight: 650;
          letter-spacing: -0.025em;
        }

        .app-page-top-workspace {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          min-width: 0;
          margin-left: auto;
        }

        /* AppShell already shows the brand in its sidebar or mobile navigation. */
        .dashboard-shell .app-page-brand {
          display: none;
        }

        @media (max-width: 640px) {
          .app-page-top-branded {
            margin-bottom: 14px;
          }

          .app-page-brand .brand-logo-image {
            width: 30px;
            height: 30px;
          }

          .app-page-brand .brand-logo-name {
            font-size: 18px;
          }

          .app-page-top-workspace {
            gap: 8px;
          }
        }
      `}</style>
    </div>
  );
}
