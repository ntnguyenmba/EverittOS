'use client';

import { AskEverittCommand } from '@/components/ask-everitt-command';
import { AppFooter } from '@/components/app-footer';
import { AppNavigationTracker } from '@/components/app-navigation-tracker';
import { AppPageContent } from '@/components/app-page-content';
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

export function AppShell({ plan, role, className, children }: AppShellProps) {
  const workspacePlan = useWorkspacePlanOptional();
  const resolvedPlan = workspacePlan?.plan ?? (plan != null ? normalizePlan(plan) : null);
  const resolvedRole = normalizeRole(role ?? workspacePlan?.role);
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
  const shellClass = ['dashboard-shell', rolePortalClass.trim(), className].filter(Boolean).join(' ');

  return (
    <div className={shellClass}>
      <div className="dashboard-shell-background" aria-hidden="true" />
      <UnsavedChangesGuard />
      <AppNavigationTracker />
      <Sidebar plan={resolvedPlan} role={resolvedRole} />
      <header className="dashboard-shell-header">
        <MobileNav plan={resolvedPlan} role={resolvedRole} />
      </header>
      <main id="main-content" className="main">
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
          background: #243f53;
        }
        .dashboard-shell-background {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background-color: #243f53;
          background-image: url('/hero.jpg');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          opacity: 1;
          filter: none;
          transform: none;
        }
        .dashboard-shell > .sidebar,.dashboard-shell-header,.dashboard-shell > .main { position: relative; z-index: 2; }
        .dashboard-shell > .sidebar { grid-area: side; display: flex; }
        .dashboard-shell-header { display: none; }
        .dashboard-shell > .main { grid-area: main; width: 100%!important; max-width: 100%!important; min-width: 0!important; margin: 0!important; padding: 28px clamp(20px,3vw,48px) 40px!important; box-sizing: border-box!important; overflow-x: clip!important; background: transparent!important; }
        .dashboard-shell .app-page-content,.dashboard-shell > .main > footer { min-width: 0!important; margin-left: auto!important; margin-right: auto!important; box-sizing: border-box!important; }
        .dashboard-shell .app-page-content,.dashboard-shell .app-page-content > * { min-width: 0!important; max-width: 100%!important; box-sizing: border-box!important; }
        .dashboard-shell .app-page-content { container-type: inline-size; background: transparent!important; }
        .dashboard-shell .language-switcher { display:grid; gap:5px; min-width:0; }
        .dashboard-shell .language-switcher-label { display:block; line-height:1.25; }
        .dashboard-shell .language-switcher-select { line-height:1.25; padding-left:12px; padding-right:32px; white-space:nowrap; }
        .dashboard-shell .owner-home-primary { display:grid!important; gap:var(--everitt-control-gap)!important; }
        .dashboard-shell .owner-home-primary > * { margin-top:0!important; margin-bottom:0!important; }
        .dashboard-shell .owner-home-kicker { display:block!important; line-height:1.35!important; }
        .dashboard-shell .owner-home-primary h2 { line-height:1.3!important; overflow-wrap:anywhere; }
        .dashboard-shell .owner-home-primary p { line-height:1.55!important; overflow-wrap:anywhere; }
        .dashboard-shell .owner-home-actions { display:flex!important; flex-wrap:wrap!important; gap:var(--everitt-control-gap)!important; padding-top:4px; }
        .role-portal-shell .btn,.role-portal-shell button,.role-portal-shell select { min-height: 44px; }
        .role-portal-shell .btn.btn-primary,.role-portal-shell .role-period-filter button.is-active,.role-portal-shell .portal-client-nav a[aria-current='page'] { background:#243f53!important; border-color:#243f53!important; color:#fff!important; }
        .role-portal-shell .portal-client-nav { display:grid!important; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--everitt-control-gap)!important; width:100%; }
        .role-portal-shell .role-summary-grid,.role-portal-shell .metric-grid { display:grid!important; gap:var(--everitt-section-gap)!important; }
        .role-portal-shell .role-summary-grid { grid-template-columns:repeat(2,minmax(0,1fr))!important; }
        .role-portal-shell .metric-grid { grid-template-columns:repeat(3,minmax(0,1fr))!important; }
        @media(max-width:1279px){
          .dashboard-shell{display:block}.dashboard-shell>.sidebar{display:none!important}.dashboard-shell-header{position:sticky;top:0;z-index:42;display:block;width:100%;padding:10px max(20px,env(safe-area-inset-right)) 0 max(20px,env(safe-area-inset-left));box-sizing:border-box}.dashboard-shell>.main{width:100%!important;max-width:none!important;margin:0!important;padding:14px max(20px,env(safe-area-inset-right)) 32px max(20px,env(safe-area-inset-left))!important}.dashboard-shell-background{background-position:56% center!important}
        }
        @media(max-width:760px){.role-portal-shell .metric-grid,.role-portal-shell .role-summary-grid{grid-template-columns:minmax(0,1fr)!important}.role-portal-shell .portal-client-nav{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:480px){.role-portal-shell .portal-client-nav{grid-template-columns:minmax(0,1fr)}}
      `}</style>
    </div>
  );
}
