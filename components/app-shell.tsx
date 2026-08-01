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

const HERO_IMAGE = 'https://raw.githubusercontent.com/ntnguyenmba/everitt-website/main/assets/images/hero.jpg';

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
          background: #e8e5df;
        }

        .dashboard-shell-background {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background: url('${HERO_IMAGE}') center / cover no-repeat;
          opacity: 0.46;
          filter: saturate(0.58) contrast(0.95) brightness(0.98);
          transform: scale(1.012);
        }

        .dashboard-shell-overlay {
          position: fixed;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background:
            linear-gradient(90deg, rgba(246,243,238,0.56), rgba(246,243,238,0.7) 20%, rgba(246,243,238,0.7) 80%, rgba(246,243,238,0.56)),
            linear-gradient(180deg, rgba(249,247,243,0.48), rgba(238,234,228,0.62));
        }

        .dashboard-shell > .sidebar,
        .dashboard-shell > .dashboard-shell-mobile,
        .dashboard-shell > .main {
          position: relative;
          z-index: 2;
        }

        .dashboard-shell > .sidebar {
          padding-left: 18px !important;
          padding-right: 18px !important;
        }

        .dashboard-shell > .main,
        .dashboard-shell .main,
        .dashboard-shell .app-page-content,
        .dashboard-shell .today-page,
        .dashboard-shell .dashboard-home,
        .dashboard-shell .authenticated-section,
        .dashboard-shell .portal-page {
          background: transparent !important;
          background-color: transparent !important;
        }

        .dashboard-shell .card,
        .dashboard-shell .panel,
        .dashboard-shell .stat,
        .dashboard-shell .dashboard-revenue-metric,
        .dashboard-shell .table-wrap,
        .dashboard-shell .settings-card {
          background: rgba(255,255,255,0.82);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .dashboard-home > .page-header {
          position: relative;
          min-height: clamp(220px, 30vw, 360px);
          margin: 0 0 24px;
          padding: clamp(30px, 5vw, 58px);
          overflow: hidden;
          align-items: flex-end;
          border: 1px solid rgba(43,54,62,0.16);
          border-radius: 26px;
          background:
            linear-gradient(90deg, rgba(28,39,46,0.78), rgba(28,39,46,0.42) 56%, rgba(28,39,46,0.08)),
            url('${HERO_IMAGE}') center / cover no-repeat;
          box-shadow: 0 22px 60px rgba(30,38,43,0.14);
        }

        .dashboard-home > .page-header::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            repeating-linear-gradient(0deg, transparent 0, transparent 31px, rgba(255,255,255,0.05) 32px),
            repeating-linear-gradient(90deg, transparent 0, transparent 31px, rgba(255,255,255,0.05) 32px);
        }

        .dashboard-home > .page-header > * {
          position: relative;
          z-index: 1;
        }

        .dashboard-home > .page-header h1,
        .dashboard-home > .page-header h2 {
          margin: 0;
          color: #f8f5ef;
          font-family: var(--font-display, Georgia, serif);
          font-size: clamp(42px, 6vw, 70px);
          font-weight: 500;
          line-height: 1;
          letter-spacing: -0.04em;
        }

        .dashboard-home > .page-header .page-subtitle,
        .dashboard-home > .page-header p {
          color: rgba(248,245,239,0.84);
        }

        .dashboard-shell .everitt-cmd-trigger {
          width: 100%;
          max-width: 620px;
          min-height: 52px;
          padding: 10px 14px;
          gap: 12px;
          justify-content: flex-start;
          background: rgba(255,255,255,0.84);
          border-color: rgba(48,55,61,0.14);
          backdrop-filter: blur(10px);
        }

        @media (min-width: 901px) {
          .dashboard-shell {
            display: grid !important;
            grid-template-columns: 280px minmax(0, 1fr) !important;
            grid-template-rows: 1fr !important;
            grid-template-areas: 'side main' !important;
          }

          .dashboard-shell-mobile {
            display: none !important;
          }

          .dashboard-shell > .sidebar {
            display: block !important;
            grid-area: side;
          }

          .dashboard-shell > .main {
            grid-area: main;
            width: 100% !important;
            max-width: 1280px !important;
            margin: 0 auto !important;
            padding: 28px 34px 42px !important;
          }
        }

        @media (max-width: 900px) {
          .dashboard-shell {
            --mobile-gutter-left: max(18px, env(safe-area-inset-left));
            --mobile-gutter-right: max(18px, env(safe-area-inset-right));
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
          }

          .dashboard-shell-background {
            opacity: 0.28;
            background-position: 56% center;
          }

          .dashboard-shell-overlay {
            background: rgba(247,244,239,0.78);
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
            min-height: 64px !important;
            padding: 9px var(--mobile-gutter-right) 9px var(--mobile-gutter-left) !important;
            background: rgba(249,247,243,0.88) !important;
            backdrop-filter: blur(14px) !important;
          }

          .dashboard-shell-mobile .mobile-nav-menu-btn {
            width: 42px !important;
            height: 42px !important;
            flex: 0 0 42px !important;
            margin: 0 !important;
          }

          .dashboard-shell > .main,
          .dashboard-shell .main {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 16px var(--mobile-gutter-right) 32px var(--mobile-gutter-left) !important;
            overflow-x: hidden !important;
          }

          .dashboard-shell .app-page-content,
          .dashboard-shell .today-page,
          .dashboard-shell .dashboard-home {
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            margin: 0 !important;
            gap: 14px !important;
          }

          .dashboard-shell .everitt-cmd-trigger {
            max-width: none !important;
            min-height: 48px !important;
            margin: 0 !important;
            padding: 8px 11px !important;
          }

          .dashboard-home > .page-header {
            min-height: 190px;
            padding: 24px 20px;
            border-radius: 18px;
            background-position: 60% center;
          }

          .dashboard-home > .page-header h1,
          .dashboard-home > .page-header h2 {
            font-size: clamp(34px, 12vw, 52px);
          }
        }
      `}</style>
    </div>
  );
}
