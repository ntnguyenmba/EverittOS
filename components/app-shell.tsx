'use client';

import { AskEverittCommand } from '@/components/ask-everitt-command';
import { AppFooter } from '@/components/app-footer';
import { AppNavigationTracker } from '@/components/app-navigation-tracker';
import { AppPageContent } from '@/components/app-page-content';
import { AppPageTop } from '@/components/app-page-top';
import { MobileNav } from '@/components/mobile-nav';
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
      <header className="dashboard-shell-header">
        <MobileNav plan={resolvedPlan} role={resolvedRole} />
      </header>
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

        .dashboard-shell-header,
        .dashboard-shell > .main {
          position: relative;
          z-index: 2;
        }

        .dashboard-shell-header {
          position: sticky;
          top: 0;
          z-index: 42;
          width: 100%;
          padding: 12px clamp(24px, 4vw, 56px) 0;
        }

        .dashboard-shell-header .mobile-nav-bar {
          width: 100% !important;
          max-width: 1240px !important;
          min-height: 68px !important;
          margin: 0 auto !important;
          padding: 10px 18px !important;
          box-sizing: border-box !important;
          border: 1px solid rgba(37, 54, 74, 0.13) !important;
          border-radius: 18px !important;
          background: rgba(255, 255, 255, 0.94) !important;
          box-shadow: 0 8px 24px rgba(37, 54, 74, 0.08) !important;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .dashboard-shell-header .mobile-nav-brand-logo,
        .dashboard-shell-header .mobile-nav-bar-actions {
          margin: 0 !important;
        }

        .dashboard-shell-header .mobile-nav-menu-btn {
          width: 44px !important;
          height: 44px !important;
          flex: 0 0 44px !important;
          margin: 0 !important;
          border-radius: 12px !important;
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

        .dashboard-shell > .main {
          width: min(1240px, calc(100% - clamp(48px, 8vw, 112px))) !important;
          max-width: 1240px !important;
          margin: 0 auto !important;
          padding: 18px 0 40px !important;
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

        @media (max-width: 900px) {
          .dashboard-shell-header {
            padding: 10px max(20px, env(safe-area-inset-right)) 0 max(20px, env(safe-area-inset-left));
          }

          .dashboard-shell-header .mobile-nav-bar {
            min-height: 64px !important;
            padding: 9px 14px !important;
            border-radius: 16px !important;
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
      `}</style>
    </div>
  );
}
