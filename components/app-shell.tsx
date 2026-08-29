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
        .dashboard-shell { position: relative; isolation: isolate; min-height: 100svh; width: 100%; max-width: 100vw; display: grid; grid-template-columns: 300px minmax(0, 1fr); grid-template-areas: 'side main'; overflow-x: clip; background: #edf2f4; }
        .dashboard-shell-background { position: fixed; inset: 0; z-index: 0; pointer-events: none; background: radial-gradient(circle at 88% 4%, rgba(80,105,121,.07), transparent 28%), linear-gradient(180deg,#f7f9fa 0%,#edf2f4 54%,#e8eef1 100%); }
        .dashboard-shell-overlay { position: fixed; inset: 0; z-index: 1; pointer-events: none; background: linear-gradient(180deg,rgba(255,255,255,.18),rgba(226,234,238,.16)); }
        .dashboard-shell > .sidebar,.dashboard-shell-header,.dashboard-shell > .main { position: relative; z-index: 2; }
        .dashboard-shell > .sidebar { grid-area: side; display: flex; }
        .dashboard-shell-header { display: none; }
        .dashboard-shell > .main { grid-area: main; width: 100%!important; max-width: 100%!important; min-width: 0!important; margin: 0!important; padding: 28px clamp(20px,3vw,48px) 40px!important; box-sizing: border-box!important; overflow-x: clip!important; }
        .dashboard-shell .app-page-top,.dashboard-shell .app-page-content,.dashboard-shell > .main > footer { min-width: 0!important; margin-left: auto!important; margin-right: auto!important; box-sizing: border-box!important; }
        .dashboard-shell .app-page-content,.dashboard-shell .app-page-content > * { min-width: 0!important; max-width: 100%!important; box-sizing: border-box!important; }
        .dashboard-shell .app-page-content { container-type: inline-size; background: transparent!important; }
        .role-portal-shell .card,.role-portal-shell .role-summary-card,.role-portal-shell .client-job-card { border: 1px solid rgba(36,63,83,.13)!important; border-radius: 16px!important; background: rgba(252,253,253,.97)!important; box-shadow: 0 10px 26px rgba(36,63,83,.07)!important; }
        .role-portal-shell .btn,.role-portal-shell button,.role-portal-shell select { min-height: 44px; }
        .role-portal-shell .btn.btn-primary,.role-portal-shell .role-period-filter button.is-active,.role-portal-shell .portal-client-nav a[aria-current='page'] { background:#3f586a!important; border-color:#3f586a!important; color:#fff!important; }
        .role-portal-shell .portal-client-nav { display:grid!important; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px!important; width:100%; }
        .role-portal-shell .role-summary-grid { display:grid!important; grid-template-columns:repeat(2,minmax(0,1fr))!important; gap:16px!important; }
        .role-portal-shell .metric-grid { display:grid!important; grid-template-columns:repeat(3,minmax(0,1fr))!important; gap:16px!important; }
        .role-portal-shell .role-summary-card,.role-portal-shell .metric-grid > .card { width:100%!important; min-width:0!important; margin:0!important; padding:22px!important; box-sizing:border-box!important; }
        @media(max-width:1279px){
          .dashboard-shell{display:block}.dashboard-shell>.sidebar{display:none!important}.dashboard-shell-header{position:sticky;top:0;z-index:42;display:block;width:100%;padding:10px max(20px,env(safe-area-inset-right)) 0 max(20px,env(safe-area-inset-left));box-sizing:border-box}.dashboard-shell-header .mobile-nav-bar{width:min(1240px,100%)!important;min-height:64px!important;margin:0 auto!important;padding:9px 14px!important;box-sizing:border-box!important;border:1px solid rgba(37,54,74,.13)!important;border-radius:16px!important;background:rgba(255,255,255,.94)!important;box-shadow:0 8px 24px rgba(37,54,74,.08)!important}.dashboard-shell>.main{width:100%!important;max-width:none!important;margin:0!important;padding:14px max(20px,env(safe-area-inset-right)) 32px max(20px,env(safe-area-inset-left))!important}.dashboard-shell .app-page-top{margin:0 auto 8px!important;padding:0!important}
        }
        @media(max-width:760px){.role-portal-shell .metric-grid,.role-portal-shell .role-summary-grid{grid-template-columns:minmax(0,1fr)!important}.role-portal-shell .portal-client-nav{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:480px){.role-portal-shell .portal-client-nav{grid-template-columns:minmax(0,1fr)}}
      `}</style>
    </div>
  );
}
