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
import { isClientRole, normalizeRole } from '@/lib/roles';
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
  const showAi = !isClientRole(normalizedRole);

  return (
    <div className={className ? `dashboard-shell ${className}` : 'dashboard-shell'}>
      <UnsavedChangesGuard />
      <AppNavigationTracker />
      <div className="dashboard-shell-mobile">
        <MobileNav plan={resolvedPlan} role={resolvedRole} />
      </div>
      <Sidebar plan={resolvedPlan} role={resolvedRole} />
      <main id="main-content" className="main">
        <AppPageTop role={resolvedRole} showBackButton={showBackButton} />
        <AppPageContent>
          {showAi ? <AskEverittCommand plan={resolvedPlan} /> : null}
          {children}
        </AppPageContent>
        <AppFooter />
      </main>

      <style jsx global>{`
        @media (pointer: coarse), (hover: none) {
          .dashboard-shell {
            --mobile-gutter-left: max(28px, env(safe-area-inset-left));
            --mobile-gutter-right: max(28px, env(safe-area-inset-right));
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            margin: 0 !important;
            grid-template-columns: minmax(0, 1fr) !important;
            grid-template-rows: auto minmax(0, 1fr) !important;
            grid-template-areas: 'mobile' 'main' !important;
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
            min-height: 64px !important;
            padding-top: 9px !important;
            padding-right: var(--mobile-gutter-right) !important;
            padding-bottom: 9px !important;
            padding-left: var(--mobile-gutter-left) !important;
            box-sizing: border-box !important;
          }

          .dashboard-shell-mobile .mobile-nav-brand-logo {
            margin: 0 !important;
            min-width: 0 !important;
            gap: 8px !important;
          }

          .dashboard-shell-mobile .mobile-nav-brand-logo .brand-logo-image {
            width: 24px !important;
            height: 24px !important;
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
            margin-left: 0 !important;
            padding-top: 12px !important;
            padding-right: var(--mobile-gutter-right) !important;
            padding-bottom: 28px !important;
            padding-left: var(--mobile-gutter-left) !important;
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

          .dashboard-shell .app-page-content {
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
            min-height: 50px !important;
            margin: 0 !important;
            padding: 10px 14px !important;
            border-radius: 13px !important;
            font-size: 15px !important;
          }

          .dashboard-shell .today-page,
          .dashboard-shell .dashboard-home {
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            margin-inline: 0 !important;
            gap: 14px !important;
            translate: none !important;
            transform: none !important;
          }
        }

        @media (min-width: 720px) and (max-width: 1100px) and (pointer: coarse),
          (min-width: 720px) and (max-width: 1100px) and (hover: none) {
          .dashboard-shell {
            --mobile-gutter-left: max(40px, env(safe-area-inset-left));
            --mobile-gutter-right: max(40px, env(safe-area-inset-right));
          }
        }
      `}</style>
    </div>
  );
}
