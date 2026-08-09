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

  // Portal users can also own a separate company. Keep the company switcher
  // available so they can move between their client/contractor view and their
  // own owner workspace without losing either membership.
  if (isFocusedPortal) {
    return (
      <div className="app-page-top app-page-top-portal">
        <div className="app-page-top-workspace app-page-top-portal-workspace">
          <OrgSwitcher />
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
            align-items: center;
            justify-content: flex-end;
            width: 100%;
            margin: 0 0 14px;
            padding: 0;
          }

          .app-page-top-portal-workspace {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 10px;
            width: min(100%, 34rem);
            margin-left: auto;
          }

          .app-page-top-portal-workspace .org-switcher {
            min-width: 0;
            flex: 1 1 16rem;
          }

          .app-page-top-language {
            flex: 0 0 min(8.75rem, 38vw);
            width: min(100%, 8.75rem);
          }

          @media (max-width: 640px) {
            .app-page-top-portal {
              margin-bottom: 10px;
            }

            .app-page-top-portal-workspace {
              align-items: stretch;
              flex-direction: column;
              gap: 8px;
              width: 100%;
            }

            .app-page-top-portal-workspace .org-switcher {
              flex-basis: auto;
              width: 100%;
            }

            .app-page-top-language {
              align-self: flex-end;
              flex-basis: auto;
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
