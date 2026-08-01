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
          opacity: 0.28;
          filter: saturate(0.5) contrast(0.92) brightness(1.02);
          transform: scale(1.015);
        }

        .dashboard-shell-overlay {
          position: fixed;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background: rgba(246, 243, 238, 0.76);
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
          background: rgba(255, 255, 255, 0.82);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .dashboard-home > .page-header {
          position: relative;
          min-height: clamp(210px, 28vw, 340px);
          margin: 0 0 22px;
          padding: clamp(26px, 4vw, 48px);
          overflow: hidden;
          align-items: flex-end;
          border: 1px solid rgba(43, 54, 62, 0.14);
          border-radius: 24px;
          background:
            linear-gradient(90deg, rgba(29, 40, 47, 0.8), rgba(29, 40, 47, 0.42) 58%, rgba(29, 40, 47, 0.1)),
            url('${HERO_IMAGE}') center / cover no-repeat;
          box-shadow: 0 18px 50px rgba(30, 38, 43, 0.12);
        }

        .dashboard-home > .page-header::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            repeating-linear-gradient(0deg, transparent 0, transparent 31px, rgba(255,255,255,0.06) 32px),
            repeating-linear-gradient(90deg, transparent 0, transparent 31px, rgba(255,255,255,0.06) 32px);
        }

        .dashboard-home > .page-header > * {
          position: relative;
          z-index: 1;
        }

        .dashboard-home > .page-header h1,
        .dashboard-home > .page-header h2 {
          color: #f8f5ef;
          font-family: var(--font-display, Georgia, serif);
          font-size: clamp(38px, 6vw, 68px);
          font-weight: 500;
          line-height: 1;
          letter-spacing: -0.04em;
        }

        .dashboard-home > .page-header .page-subtitle,
        .dashboard-home > .page-header p {
          color: rgba(248, 245, 239, 0.82);
        }

        @media (pointer: coarse), (hover: none) {
          .dashboard-shell {
            --mobile-gutter-left: max(18px, env(safe-area-inset-left));
            --mobile-gutter-right: max(18px, env(safe-area-inset-right));
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            margin: 0 !important;
            grid-template-columns: minmax(0, 1fr) !important;
            grid-template-rows: auto minmax(0, 1fr) !important;
            grid-template-areas: 'mobile' 'main' !important;
          }

          .dashboard-shell-background {
            background-position: 56% center;
            opacity: 0.2;
          }

          .dashboard-shell-overlay {
            background: rgba(247, 244, 239, 0.82);
          }

          .dashboard-shell > .sidebar {
            display: none !important;
            position: absolute !important;
            width: 0 !important;
            min-width: 0 !important;
            max-width: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
            visibility: hidden !important;
            pointer-events: none !important;
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
            min-height: 62px !important;
            padding: 8px var(--mobile-gutter-right) 8px var(--mobile-gutter-left) !important;
            box-sizing: border-box !important;
            background: rgba(249,247,243,0.86) !important;
            backdrop-filter: blur(14px) !important;
          }

          .dashboard-shell-mobile .mobile-nav-brand-logo {
            margin: 0 !important;
            min-width: 0 !important;
            gap: 8px !important;
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

          .dashboard-shell-mobile .mobile-nav-bar-actions {
            margin: 0 !important;
            flex: 0 0 auto !important;
          }

          .dashboard-shell-mobile .mobile-nav-menu-btn {
            width: 40px !important;
            height: 40px !important;
            flex: 0 0 40px !important;
            margin: 0 !important;
            box-shadow: none !important;
          }

          .dashboard-shell > .main,
          .dashboard-shell .main {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            margin: 0 !important;
            margin-left: 0 !important;
            padding: 12px var(--mobile-gutter-right) 30px var(--mobile-gutter-left) !important;
            overflow-x: hidden !important;
            translate: none !important;
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

          .dashboard-shell .app-page-content,
          .dashboard-shell .today-page,
          .dashboard-shell .dashboard-home {
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            margin: 0 !important;
            gap: 14px !important;
            translate: none !important;
            transform: none !important;
          }

          .dashboard-shell .everitt-cmd-trigger {
            width: 100% !important;
            max-width: none !important;
            min-height: 48px !important;
            margin: 0 !important;
            padding: 8px 11px !important;
            font-size: 13px !important;
          }

          .dashboard-home > .page-header {
            min-height: 190px;
            padding: 24px;
            border-radius: 18px;
            background-position: 60% center;
          }

          .dashboard-home > .page-header h1,
          .dashboard-home > .page-header h2 {
            font-size: clamp(34px, 12vw, 52px);
          }
        }

        @media (min-width: 720px) and (max-width: 1100px) and (pointer: coarse),
          (min-width: 720px) and (max-width: 1100px) and (hover: none) {
          .dashboard-shell {
            --mobile-gutter-left: max(32px, env(safe-area-inset-left));
            --mobile-gutter-right: max(32px, env(safe-area-inset-right));
          }
        }
      `}</style>
    </div>
  );
}
