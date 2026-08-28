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
  const isClientPortal = isClientRole(normalizedRole);
  const isContractorPortal = isContractorRole(normalizedRole);
  const isRolePortal = isClientPortal || isContractorPortal;
  const showAi = !isRolePortal;
  const rolePortalClass = isContractorPortal
    ? ' role-portal-shell role-portal-contractor'
    : isClientPortal
      ? ' role-portal-shell role-portal-client'
      : '';

  return (
    <div className={`dashboard-shell${rolePortalClass}`}>
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
          overflow-x: clip;
          background: #edf2f4;
        }

        .dashboard-shell-background {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 88% 4%, rgba(80, 105, 121, 0.07), transparent 28%),
            linear-gradient(180deg, #f7f9fa 0%, #edf2f4 54%, #e8eef1 100%);
          opacity: 1;
          filter: none;
          transform: none;
        }

        .dashboard-shell-overlay {
          position: fixed;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(226, 234, 238, 0.16));
        }

        .dashboard-shell.role-portal-shell {
          background: #edf2f4;
        }

        .role-portal-shell .dashboard-shell-background {
          background:
            radial-gradient(circle at 88% 4%, rgba(80, 105, 121, 0.07), transparent 28%),
            linear-gradient(180deg, #f7f9fa 0%, #edf2f4 54%, #e8eef1 100%);
          opacity: 1;
          filter: none;
          transform: none;
        }

        .role-portal-shell .dashboard-shell-overlay {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(226, 234, 238, 0.16));
        }

        .role-portal-shell .app-page-content {
          padding-top: 6px;
        }

        .role-portal-shell .card,
        .role-portal-shell .role-summary-card,
        .role-portal-shell .client-job-card {
          border: 1px solid rgba(36, 63, 83, 0.13) !important;
          border-radius: 16px !important;
          background: rgba(252, 253, 253, 0.97) !important;
          box-shadow: 0 10px 26px rgba(36, 63, 83, 0.07) !important;
        }

        .role-portal-shell .eyebrow {
          border-color: rgba(36, 63, 83, 0.16) !important;
          background: #edf2f5 !important;
          color: #243f53 !important;
        }

        .role-portal-shell .btn,
        .role-portal-shell button,
        .role-portal-shell select {
          min-height: 44px;
        }

        .role-portal-shell .role-period-filter button.is-active,
        .role-portal-shell .btn.btn-primary,
        .role-portal-shell .portal-client-nav a[aria-current='page'] {
          background: #3f586a !important;
          border-color: #3f586a !important;
          color: #ffffff !important;
        }

        .role-portal-shell .role-period-filter button.is-active *,
        .role-portal-shell .btn.btn-primary *,
        .role-portal-shell .portal-client-nav a[aria-current='page'] * {
          color: #ffffff !important;
        }

        .role-portal-shell .button-row,
        .role-portal-shell .role-dashboard-topbar,
        .role-portal-shell .portal-client-nav {
          align-items: stretch !important;
          gap: 10px !important;
        }

        .role-portal-shell .contractor-portal-actions {
          display: grid !important;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          width: min(720px, 100%);
        }

        .role-portal-shell .button-row .btn,
        .role-portal-shell .role-dashboard-topbar > *,
        .role-portal-shell .portal-client-nav a,
        .role-portal-shell .portal-client-nav button {
          min-height: 44px !important;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          margin: 0 !important;
        }

        .role-portal-shell .portal-client-nav {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          width: 100%;
        }

        .role-portal-shell .role-summary-grid {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          grid-auto-rows: 1fr !important;
          gap: 16px !important;
          align-items: stretch !important;
        }

        .role-portal-shell .metric-grid {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          grid-auto-rows: 1fr !important;
          gap: 16px !important;
          align-items: stretch !important;
        }

        .role-portal-shell .role-summary-card,
        .role-portal-shell .metric-grid > .card {
          width: 100% !important;
          min-width: 0 !important;
          height: 100% !important;
          min-height: 140px !important;
          margin: 0 !important;
          padding: 22px !important;
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: column;
          justify-content: center;
          align-self: stretch !important;
          transform: none !important;
          position: relative !important;
          top: auto !important;
          bottom: auto !important;
        }

        .role-portal-contractor .contractor-dashboard > header.card {
          padding: 24px !important;
        }

        .role-portal-contractor .metric-grid > .card {
          min-height: 116px !important;
          padding: 18px 20px !important;
          box-shadow: 0 6px 18px rgba(36, 63, 83, 0.055) !important;
        }

        .role-portal-contractor .metric-grid > .card h2 {
          margin-top: 8px !important;
          line-height: 1 !important;
        }

        .role-portal-contractor .list-row > span:last-child {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 5px 10px;
          border: 1px solid rgba(36, 63, 83, 0.16);
          border-radius: 999px;
          background: #edf2f5;
          color: #243f53;
          font-weight: 700;
          text-transform: capitalize;
        }

        .role-portal-client .role-summary-card {
          min-height: 124px !important;
        }

        .role-portal-client .client-job-card {
          padding: 20px !important;
          box-shadow: 0 6px 18px rgba(36, 63, 83, 0.05) !important;
        }

        .role-portal-client .client-job-card h3 {
          margin-bottom: 6px !important;
        }

        .role-portal-client .status-badge {
          background: #edf2f5 !important;
          border-color: rgba(36, 63, 83, 0.16) !important;
          color: #243f53 !important;
          font-weight: 700;
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
          padding: 28px clamp(20px, 3vw, 48px) 40px !important;
          box-sizing: border-box !important;
          overflow-x: clip !important;
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

        .dashboard-shell .app-page-content,
        .dashboard-shell .app-page-content > *,
        .dashboard-shell .dashboard-home,
        .dashboard-shell .role-dashboard,
        .dashboard-shell .field-dashboard {
          min-width: 0 !important;
          max-width: 100% !important;
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

        @media (max-width: 1279px) {
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
            box-sizing: border-box;
          }

          .dashboard-shell-header .mobile-nav-bar {
            width: min(1240px, 100%) !important;
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
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 14px max(20px, env(safe-area-inset-right)) 32px max(20px, env(safe-area-inset-left)) !important;
          }

          .dashboard-shell-background {
            opacity: 1;
          }

          .dashboard-shell-overlay {
            background: rgba(235, 241, 244, 0.2);
          }

          .role-portal-shell .dashboard-shell-background {
            opacity: 1;
          }

          .role-portal-shell .dashboard-shell-overlay {
            background: rgba(235, 241, 244, 0.2);
          }

          .dashboard-shell .app-page-top {
            margin: 0 auto 8px !important;
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

        @media (max-width: 760px) {
          .role-portal-shell .metric-grid,
          .role-portal-shell .role-summary-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .role-portal-shell .contractor-portal-actions,
          .role-portal-shell .portal-client-nav {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            width: 100%;
          }

          .role-portal-contractor .contractor-dashboard > header.card {
            padding: 18px !important;
          }

          .role-portal-contractor .contractor-portal-actions {
            gap: 10px !important;
          }

          .role-portal-contractor .contractor-portal-actions .btn {
            min-height: 58px !important;
            padding: 12px 14px !important;
            font-size: 16px !important;
            font-weight: 750 !important;
          }

          .role-portal-contractor .contractor-portal-actions .btn:first-child {
            grid-column: 1 / -1;
            min-height: 64px !important;
            font-size: 17px !important;
          }

          .role-portal-contractor .metric-grid {
            gap: 10px !important;
          }

          .role-portal-contractor .metric-grid > .card {
            min-height: 96px !important;
            padding: 16px 18px !important;
          }

          .role-portal-contractor .list-row {
            gap: 12px !important;
            padding-block: 16px !important;
          }

          .role-portal-client .role-dashboard-topbar {
            gap: 12px !important;
          }

          .role-portal-client .client-job-card {
            padding: 18px !important;
          }
        }

        @media (max-width: 680px) {
          .dashboard-shell .dashboard-revenue-grid,
          .dashboard-shell .role-dashboard > .stats-grid,
          .dashboard-shell .field-dashboard > .stats-grid,
          .dashboard-shell .team-command-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .role-portal-shell .button-row,
          .role-portal-shell .role-dashboard-topbar {
            align-items: stretch !important;
          }
        }

        @media (max-width: 480px) {
          .role-portal-shell .contractor-portal-actions,
          .role-portal-shell .portal-client-nav {
            grid-template-columns: minmax(0, 1fr);
          }

          .role-portal-contractor .contractor-portal-actions .btn:first-child {
            grid-column: auto;
          }

          .role-portal-client .role-summary-card {
            min-height: 108px !important;
          }
        }
      `}</style>
    </div>
  );
}
