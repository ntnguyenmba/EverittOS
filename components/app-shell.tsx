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

export function AppShell({ plan, role, showBackButton = true, children }: AppShellProps) {
  const workspacePlan = useWorkspacePlanOptional();
  const resolvedPlan = workspacePlan?.plan ?? (plan != null ? normalizePlan(plan) : null);
  const resolvedRole = workspacePlan?.role ?? normalizeRole(role);
  const normalizedRole = normalizeRole(resolvedRole);
  const showAi = !isClientRole(normalizedRole) && !isContractorRole(normalizedRole);

  return (
    <div className="dashboard-shell">
      <div className="dashboard-shell-background" aria-hidden="true" />
      <div className="dashboard-shell-overlay" aria-hidden="true" />
      <UnsavedChangesGuard />
      <AppNavigationTracker />
      <Sidebar plan={resolvedPlan} role={resolvedRole} />
      <header className="dashboard-shell-header">
        <MobileNav plan={resolvedPlan} role={resolvedRole} />
      </header>
      <main id="main-content" className="main">
        <AppPageTop role={resolvedRole} showBackButton={showBackButton} />
        <AppPageContent>
          {showAi ? <AskEverittCommand plan={resolvedPlan} embedded={false} /> : null}
          {children}
        </AppPageContent>
        <AppFooter />
      </main>

      <style jsx global>{`
        .dashboard-shell {
          position: relative;
          isolation: isolate;
          min-height: 100svh;
          width: 100%;
          max-width: 100vw;
          display: grid;
          grid-template-columns: 300px minmax(0, 1fr);
          grid-template-areas: 'side main';
          overflow-x: hidden;
          background: #dfe8ee;
        }

        .dashboard-shell-background {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background: #dfe8ee url('/hero.jpg') center / cover no-repeat;
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
        .dashboard-shell-header,
        .dashboard-shell > .main {
          position: relative;
          z-index: 2;
        }

        .dashboard-shell > .sidebar {
          grid-area: side;
          display: flex;
        }

        .dashboard-shell-header {
          display: none;
        }

        .dashboard-shell > .main {
          grid-area: main;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          margin: 0 !important;
          padding: 28px clamp(24px, 4vw, 56px) 40px !important;
          box-sizing: border-box !important;
          overflow-x: hidden !important;
        }

        .dashboard-shell .app-page-top,
        .dashboard-shell .app-page-content,
        .dashboard-shell > .main > footer {
          width: min(1240px, 100%) !important;
          max-width: 100% !important;
          min-width: 0 !important;
          margin-left: auto !important;
          margin-right: auto !important;
          box-sizing: border-box !important;
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
          max-width: 100% !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
        }

        .dashboard-shell .app-page-content {
          container-type: inline-size;
        }

        .dashboard-shell .dashboard-revenue-grid,
        .dashboard-shell .role-dashboard > .stats-grid,
        .dashboard-shell .field-dashboard > .stats-grid,
        .dashboard-shell .team-command-grid {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 16px !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
        }

        .dashboard-shell .dashboard-revenue-grid > *,
        .dashboard-shell .stats-grid > *,
        .dashboard-shell .team-command-grid > * {
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }

        .mobile-nav-close-btn {
          min-width: max-content !important;
          white-space: nowrap !important;
          overflow-wrap: normal !important;
          word-break: normal !important;
          writing-mode: horizontal-tb !important;
        }

        @container (max-width: 720px) {
          .dashboard-shell .dashboard-revenue-grid,
          .dashboard-shell .role-dashboard > .stats-grid,
          .dashboard-shell .field-dashboard > .stats-grid,
          .dashboard-shell .team-command-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }

        @media (min-width: 1700px) {
          .dashboard-shell .dashboard-revenue-grid,
          .dashboard-shell .role-dashboard > .stats-grid,
          .dashboard-shell .field-dashboard > .stats-grid,
          .dashboard-shell .team-command-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 1180px) and (min-width: 1024px) {
          .dashboard-shell {
            grid-template-columns: 260px minmax(0, 1fr);
          }

          .dashboard-shell > .main {
            padding-left: 24px !important;
            padding-right: 24px !important;
          }
        }

        @media (max-width: 1023px) {
          .dashboard-shell {
            display: block;
          }

          .dashboard-shell > .sidebar {
            display: none !important;
          }

          .dashboard-shell-header {
            position: sticky;
            top: 0;
            z-index: 42;
            display: block;
            width: 100%;
            padding: 10px max(20px, env(safe-area-inset-right)) 0 max(20px, env(safe-area-inset-left));
          }

          .dashboard-shell-header .mobile-nav-bar {
            width: 100% !important;
            min-height: 64px !important;
            margin: 0 auto !important;
            padding: 9px 14px !important;
            box-sizing: border-box !important;
            border: 1px solid rgba(37, 54, 74, 0.13) !important;
            border-radius: 16px !important;
            background: rgba(255, 255, 255, 0.94) !important;
            box-shadow: 0 8px 24px rgba(37, 54, 74, 0.08) !important;
          }

          .dashboard-shell > .main {
            width: auto !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 14px max(20px, env(safe-area-inset-right)) 32px max(20px, env(safe-area-inset-left)) !important;
          }

          .dashboard-shell-background {
            background-position: 56% center;
            opacity: 0.44;
          }

          .dashboard-shell-overlay {
            background: rgba(231, 238, 243, 0.61);
          }

          .dashboard-shell .app-page-top {
            margin: 0 0 8px !important;
            padding: 0 !important;
          }

          .dashboard-shell .everitt-cmd-trigger {
            width: 100% !important;
            min-height: 50px !important;
            margin: 0 !important;
            padding: 10px 14px !important;
            border-radius: 13px !important;
          }
        }

        @media (max-width: 680px) {
          .dashboard-shell .dashboard-revenue-grid,
          .dashboard-shell .role-dashboard > .stats-grid,
          .dashboard-shell .field-dashboard > .stats-grid,
          .dashboard-shell .team-command-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}
