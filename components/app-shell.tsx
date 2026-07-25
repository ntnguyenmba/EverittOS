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
        /* Touch devices such as iPad can report a desktop-sized pixel width.
           Choose the tablet layout from CSS input capabilities at first paint,
           before React hydration or native platform detection can change state. */
        @media (pointer: coarse), (hover: none) {
          .dashboard-shell {
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
            min-height: 68px !important;
            padding: 10px 24px !important;
            box-sizing: border-box !important;
          }

          .dashboard-shell-mobile .mobile-nav-brand-logo {
            margin: 0 !important;
            min-width: 0 !important;
          }

          .dashboard-shell-mobile .mobile-nav-menu-btn {
            flex: 0 0 46px !important;
            margin: 0 !important;
          }

          .dashboard-shell > .main,
          .dashboard-shell .main {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            margin: 0 !important;
            margin-left: 0 !important;
            translate: none !important;
            transform: none !important;
          }

          .dashboard-shell .app-page-content,
          .dashboard-shell .today-page,
          .dashboard-shell .dashboard-home {
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            margin-inline: 0 !important;
            translate: none !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}
