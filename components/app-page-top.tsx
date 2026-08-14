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

  // Portal users can also own a separate company. Keep the workspace switcher
  // available so they can move between their client/contractor view and their
  // own owner workspace without losing either membership.
  if (isFocusedPortal) {
    return (
      <div className="app-page-top app-page-top-portal">
        <div className="app-page-top-workspace app-page-top-portal-workspace">
          <div className="app-page-top-portal-org">
            <OrgSwitcher />
          </div>
          <div className="app-page-top-language">
            <LanguageSwitcher
              id={isContractorRole(normalizedRole) ? 'contractor-portal-top-language' : 'client-portal-language'}
              variant="compact"
            />
          </div>
        </div>

        <style jsx global>{`
          .app-page-top-portal {
            display: flex;
            align-items: flex-end;
            justify-content: flex-end;
            width: 100%;
            margin: 0 0 14px;
            padding: 0;
          }

          .app-page-top-portal-workspace {
            display: grid;
            grid-template-columns: minmax(220px, 300px) minmax(120px, 140px);
            align-items: end;
            justify-content: end;
            gap: 10px;
            width: auto;
            max-width: 100%;
            margin-left: auto;
          }

          .app-page-top-portal-org {
            min-width: 0;
            width: 100%;
          }

          .app-page-top-portal-workspace .org-switcher {
            width: 100%;
            min-width: 0;
            margin: 0;
          }

          .app-page-top-portal-workspace .org-switcher-label {
            display: block;
            width: auto;
            margin: 0 0 5px;
            white-space: nowrap;
          }

          .app-page-top-portal-workspace .org-switcher-select {
            width: 100%;
            max-width: 100%;
          }

          .app-page-top-language {
            width: 100%;
            min-width: 0;
          }

          .app-page-top-language select,
          .app-page-top-language button {
            width: 100%;
          }

          @media (max-width: 640px) {
            .app-page-top-portal {
              margin-bottom: 10px;
            }

            .app-page-top-portal-workspace {
              grid-template-columns: minmax(0, 1fr) 120px;
              width: 100%;
              gap: 8px;
            }
          }

          @media (max-width: 430px) {
            .app-page-top-portal-workspace {
              grid-template-columns: 1fr;
            }

            .app-page-top-language {
              width: 120px;
              justify-self: end;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`app-page-top app-page-top-branded${normalizedRole === 'owner' ? ' app-page-top-owner' : ''}`}>
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

        .app-page-top-owner .app-page-top-workspace {
          max-width: 100%;
          flex-wrap: nowrap;
        }

        .app-page-top-owner .org-switcher {
          flex: 1 1 220px;
          min-width: 0;
          max-width: 280px;
          margin-left: 0;
          flex-wrap: nowrap;
        }

        .app-page-top-owner .org-switcher-label {
          display: none;
        }

        .app-page-top-owner .org-switcher-select {
          width: 100%;
          min-width: 0;
          max-width: 280px;
          white-space: nowrap;
          text-overflow: ellipsis;
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

          .app-page-top-owner .org-switcher {
            max-width: min(220px, calc(100vw - 92px));
          }

          .app-page-top-owner .org-switcher-select {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
