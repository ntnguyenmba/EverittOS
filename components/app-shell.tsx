'use client';

import { AskEverittCommand } from '@/components/ask-everitt-command';
import { AppFooter } from '@/components/app-footer';
import { AppNavigationTracker } from '@/components/app-navigation-tracker';
import { AppPageContent } from '@/components/app-page-content';
import { AppPageTop } from '@/components/app-page-top';
import { MobileNav } from '@/components/mobile-nav';
import { Sidebar } from '@/components/sidebar';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { useWorkspacePlanOptional } from '@/components/workspace-plan-provider';
import { isClientRole, isContractorRole, normalizeRole } from '@/lib/roles';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import type { UserRole } from '@/lib/roles';

type AppShellProps = {
  plan?: EverittosPlan | string | null;
  role?: UserRole | string | null;
  showBackButton?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function AppShell({ plan, role, showBackButton = true, className, children }: AppShellProps) {
  const workspacePlan = useWorkspacePlanOptional();
  const resolvedPlan = workspacePlan?.plan ?? (plan != null ? normalizePlan(plan) : null);
  const resolvedRole = workspacePlan?.role ?? normalizeRole(role);
  const normalizedRole = normalizeRole(resolvedRole);
  const showAi = !isClientRole(normalizedRole) && !isContractorRole(normalizedRole);
  const showEmbeddedAskEveritt = className?.split(/\s+/).includes('jobs-shell-minimal') ?? false;

  return (
    <div className={className ? `dashboard-shell ${className}` : 'dashboard-shell'}>
      <div className="dashboard-shell-background" aria-hidden="true" />
      <div className="dashboard-shell-overlay" aria-hidden="true" />
      <UnsavedChangesGuard />
      <AppNavigationTracker />
      <div className="dashboard-shell-mobile">
        <MobileNav plan={resolvedPlan} role={resolvedRole} />
      </div>
      <Sidebar plan={resolvedPlan} role={resolvedRole} />
      <main id="main-content" className="main">
        <AppPageTop role={resolvedRole} showBackButton={showBackButton} />
        <AppPageContent>
          {showAi ? <AskEverittCommand plan={resolvedPlan} embedded={showEmbeddedAskEveritt} /> : null}
          {children}
        </AppPageContent>
        <AppFooter />
      </main>

      <style jsx global>{`
        .dashboard-shell {
          position: relative;
          isolation: isolate;
          min-height: 100svh;
          background: #dfe8ee;
        }

        .dashboard-shell-background {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background-color: #dfe8ee;
          background-image: url('/hero.jpg');
          background-repeat: no-repeat;
          background-size: cover;
          background-position: center;
          opacity: 0.58;
          filter: saturate(0.74) contrast(0.98) brightness(0.86);
          transform: scale(1.015);
        }

        .dashboard-shell-overlay {
          position: fixed;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background:
            linear-gradient(90deg, rgba(221, 231, 238, 0.18), rgba(237, 242, 246, 0.5) 21%, rgba(237, 242, 246, 0.5) 79%, rgba(221, 231, 238, 0.18)),
            linear-gradient(180deg, rgba(238, 243, 247, 0.22), rgba(221, 231, 238, 0.4));
        }

        .dashboard-shell > .sidebar,
        .dashboard-shell > .dashboard-shell-mobile,
        .dashboard-shell > .main {
          position: relative;
          z-index: 2;
        }

        .dashboard-shell > .main,
        .dashboard-shell .main,
        .dashboard-shell .app-page-content,
        .dashboard-shell .today-page,
        .dashboard-shell .dashboard-home,
        .dashboard-shell .portal-page,
        .dashboard-shell .authenticated-portal {
          background: transparent !important;
          background-color: transparent !important;
        }

        .dashboard-shell .app-page-content,
        .dashboard-shell .today-page,
        .dashboard-shell .dashboard-home,
        .dashboard-shell .portal-page,
        .dashboard-shell .authenticated-portal {
          width: 100% !important;
          max-width: none !important;
          min-width: 0 !important;
          margin-inline: 0 !important;
        }

        @media (min-width: 901px) {
          .dashboard-shell {
            display: grid !important;
            grid-template-columns: 272px minmax(0, 1fr) !important;
            grid-template-areas: 'side main' !important;
          }

          .dashboard-shell-mobile {
            display: none !important;
          }

          .dashboard-shell > .sidebar {
            display: block !important;
            grid-area: side !important;
            padding-left: 20px !important;
            padding-right: 20px !important;
          }

          .dashboard-shell > .main {
            grid-area: main !important;
            width: 100% !important;
            max-width: 1280px !important;
            margin: 0 auto !important;
            padding: 26px 32px 40px !important;
          }
        }

        @media (max-width: 900px) {
          .dashboard-shell {
            --mobile-gutter-left: max(24px, env(safe-area-inset-left));
            --mobile-gutter-right: max(24px, env(safe-area-inset-right));
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            margin: 0 !important;
          }

          .dashboard-shell-background {
            background-position: 56% center;
            opacity: 0.44;
          }

          .dashboard-shell-overlay {
            background: rgba(231, 238, 243, 0.61);
          }

          .dashboard-shell > .sidebar {
            display: none !important;
          }

          .dashboard-shell-mobile {
            display: block !important;
            position: sticky !important;
            top: 0;
            z-index: 42;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .dashboard-shell-mobile .mobile-nav-bar {
            width: 100% !important;
            min-height: 68px !important;
            padding: 10px var(--mobile-gutter-right) !important;
            box-sizing: border-box !important;
          }

          .dashboard-shell-mobile .mobile-nav-brand-logo,
          .dashboard-shell-mobile .mobile-nav-bar-actions {
            margin: 0 !important;
          }

          .dashboard-shell-mobile .mobile-nav-brand-logo {
            min-width: 0 !important;
            gap: 9px !important;
          }

          .dashboard-shell-mobile .mobile-nav-brand-logo .brand-logo-image {
            width: 26px !important;
            height: 26px !important;
            border-radius: 7px !important;
          }

          .dashboard-shell-mobile .mobile-nav-brand-logo .brand-logo-name {
            font-size: 19px !important;
            font-weight: 600 !important;
            letter-spacing: -0.025em !important;
          }

          .dashboard-shell-mobile .mobile-nav-menu-btn {
            width: 44px !important;
            height: 44px !important;
            flex: 0 0 44px !important;
            margin: 0 !important;
            border-radius: 12px !important;
            box-shadow: 0 4px 12px rgba(36, 63, 83, 0.14) !important;
          }

          .dashboard-shell > .main,
          .dashboard-shell .main {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 14px var(--mobile-gutter-right) 32px var(--mobile-gutter-left) !important;
            transform: none !important;
          }

          .dashboard-shell .app-page-top {
            display: flex !important;
            align-items: center !important;
            justify-content: flex-start !important;
            gap: 10px !important;
            min-height: 0 !important;
            margin: 0 0 8px !important;
            padding: 0 !important;
          }

          .dashboard-shell .app-page-top-actions {
            order: -1 !important;
            margin: 0 !important;
          }

          .dashboard-shell .org-switcher {
            margin-left: auto !important;
          }

          .dashboard-shell .app-back-button {
            min-height: 38px !important;
            padding: 6px 10px !important;
            border: 0 !important;
            border-radius: 10px !important;
            background: transparent !important;
            box-shadow: none !important;
            color: var(--text-secondary) !important;
            font-size: 15px !important;
            font-weight: 600 !important;
          }

          .dashboard-shell .app-page-content {
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            margin: 0 !important;
            gap: 14px !important;
          }

          .dashboard-shell .everitt-cmd-trigger {
            width: 100% !important;
            min-height: 50px !important;
            margin: 0 !important;
            padding: 10px 14px !important;
            border-radius: 13px !important;
            font-size: 15px !important;
          }
        }

        @media (min-width: 720px) and (max-width: 900px) {
          .dashboard-shell {
            --mobile-gutter-left: max(36px, env(safe-area-inset-left));
            --mobile-gutter-right: max(36px, env(safe-area-inset-right));
          }
        }
      `}</style>
    </div>
  );
}
