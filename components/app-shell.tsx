'use client';

import { AskEverittCommand } from '@/components/ask-everitt-command';
import { AppFooter } from '@/components/app-footer';
import { AppNavigationTracker } from '@/components/app-navigation-tracker';
import { AppPageContent } from '@/components/app-page-content';
import { MobileNav } from '@/components/mobile-nav';
import { useTranslation } from '@/components/locale-provider';
import { Sidebar } from '@/components/sidebar';
import { UnsavedChangesGuard } from '@/components/unsaved-changes-guard';
import { useWorkspacePlanOptional } from '@/components/workspace-plan-provider';
import { isClientRole, isContractorRole, normalizeRole } from '@/lib/roles';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import type { UserRole } from '@/lib/roles';

type RoleBannerKind = 'owner' | 'client' | 'worker';

const ROLE_BANNER_COPY = {
  en: { context: 'Signed in as', owner: 'Owner', client: 'Client', worker: 'Worker' },
  es: { context: 'Sesión iniciada como', owner: 'Propietario', client: 'Cliente', worker: 'Trabajador' },
  vi: { context: 'Đang đăng nhập với vai trò', owner: 'Chủ doanh nghiệp', client: 'Khách hàng', worker: 'Nhân viên' }
} as const;

const PORTAL_NAV_COPY = {
  en: { home: 'Home', jobs: 'Jobs', settings: 'Settings' },
  es: { home: 'Inicio', jobs: 'Trabajos', settings: 'Configuración' },
  vi: { home: 'Trang chủ', jobs: 'Công việc', settings: 'Cài đặt' }
} as const;

function roleBannerKind(role: UserRole): RoleBannerKind {
  if (role === 'client') return 'client';
  if (role === 'contractor' || role === 'employee' || role === 'viewer') return 'worker';
  return 'owner';
}

function RoleContextBanner({ role }: { role: UserRole }) {
  const { locale } = useTranslation();
  const copy = ROLE_BANNER_COPY[locale];
  const kind = roleBannerKind(role);

  return (
    <section className={`app-role-banner app-role-banner-${kind}`} aria-label={`${copy.context}: ${copy[kind]}`}>
      <span className="app-role-banner-context">{copy.context}</span>
      <strong className="app-role-banner-name">{copy[kind]}</strong>
    </section>
  );
}

function ContractorBottomNav() {
  const { locale } = useTranslation();
  const copy = PORTAL_NAV_COPY[locale];
  return (
    <nav className="contractor-fixed-bottom-nav" aria-label="Worker navigation">
      <a href="/portal/contractor">{copy.home}</a>
      <a href="/portal/contractor#jobs">{copy.jobs}</a>
      <a href="/portal/contractor/settings">{copy.settings}</a>
    </nav>
  );
}

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
  const roleSource = role ?? workspacePlan?.role;
  const resolvedRole = normalizeRole(roleSource);
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
  const shellClass = ['dashboard-shell', 'shared-hamburger-shell', rolePortalClass.trim(), className].filter(Boolean).join(' ');

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
        <AppPageContent>
          {showAi ? <AskEverittCommand plan={resolvedPlan} embedded={false} /> : null}
          {roleSource ? <RoleContextBanner role={resolvedRole} /> : null}
          {children}
        </AppPageContent>
        <AppFooter />
      </main>
      {isContractorPortal ? <ContractorBottomNav /> : null}

      <style jsx global>{`
        :root {
          --navy-primary: #243f53;
          --navy-secondary: #1d3343;
          --accent: #285d78;
          --accent-strong: #243f53;
          --secondary-blue: #285d78;
          --selected: #eef3f5;
          --warm-white: #ffffff;
          --soft-white: #ffffff;
          --bg: #e9eef2;
        }
        .dashboard-shell {
          position: relative;
          isolation: isolate;
          min-height: 100dvh;
          width: 100%;
          max-width: 100%;
          display: block;
          overflow-x: clip;
          background: var(--eo-color-page);
        }
        .dashboard-shell-background {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background-image: url('/hero.jpg');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          opacity: 0.48;
          filter: saturate(0.45) contrast(0.96) brightness(0.78);
          transform: none;
        }
        .dashboard-shell-overlay {
          position: fixed;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background: rgba(19, 36, 51, 0.58);
        }
        .dashboard-shell > .sidebar,.dashboard-shell-header,.dashboard-shell > .main { position: relative; z-index: 2; }
        .dashboard-shell > .sidebar { display: none; }
        .dashboard-shell-header {
          position: sticky;
          top: 0;
          z-index: 42;
          display: block;
          width: 100%;
          max-width: 100%;
          padding: max(8px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) 8px max(14px, env(safe-area-inset-left));
          box-sizing: border-box;
          background: #243f53;
          border-bottom: 1px solid rgba(255,255,255,.08);
        }
        .dashboard-shell > .main { width: 100%!important; max-width: 100%!important; min-width: 0!important; margin: 0!important; padding: 16px max(var(--eo-space-5),env(safe-area-inset-right)) 24px max(var(--eo-space-5),env(safe-area-inset-left))!important; box-sizing: border-box!important; overflow-x: clip!important; background: transparent!important; }
        .dashboard-shell .app-page-content,.dashboard-shell > .main > footer { min-width: 0!important; margin-left: auto!important; margin-right: auto!important; box-sizing: border-box!important; }
        .dashboard-shell .app-page-content,.dashboard-shell .app-page-content > * { min-width: 0!important; max-width: 100%!important; box-sizing: border-box!important; }
        .dashboard-shell .app-page-content { container-type: inline-size; background: transparent!important; display:flex!important; flex-direction:column!important; gap:16px!important; }
        .app-role-banner {
          width: 100% !important;
          min-width: 0 !important;
          min-height: 68px;
          margin: 0 !important;
          padding: var(--eo-space-4) var(--eo-space-5);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--eo-space-4);
          box-sizing: border-box;
          border: 1px solid rgba(255,255,255,.2);
          border-radius: var(--eo-radius-card);
          background: var(--eo-color-brand);
          color: #fff;
          box-shadow: var(--eo-shadow-card);
        }
        .app-role-banner-context { min-width: 0; color: rgba(255,255,255,.76) !important; font-size: 12px; font-weight: 700; line-height: 1.3; letter-spacing: .055em; text-transform: uppercase; }
        .app-role-banner-name { color: #fff !important; font-size: 18px; font-weight: 800; line-height: 1.2; text-align: right; }
        .dashboard-shell .contractor-role-label { display: none !important; }
        .dashboard-shell .language-switcher { display:grid; gap:5px; min-width:0; }
        .dashboard-shell .language-switcher-label { display:block; line-height:1.25; }
        .dashboard-shell .language-switcher-select { line-height:1.25; padding-left:12px; padding-right:32px; white-space:nowrap; }
        .dashboard-shell .owner-home-primary { display:grid!important; gap:var(--eo-control-gap)!important; }
        .dashboard-shell .owner-home-primary > * { margin-top:0!important; margin-bottom:0!important; }
        .dashboard-shell .owner-home-kicker { display:block!important; line-height:1.35!important; }
        .dashboard-shell .owner-home-primary h2 { line-height:1.3!important; overflow-wrap:anywhere; }
        .dashboard-shell .owner-home-primary p { line-height:1.55!important; overflow-wrap:anywhere; }
        .dashboard-shell .owner-home-actions { display:flex!important; flex-wrap:wrap!important; gap:var(--eo-control-gap)!important; padding-top:4px; }
        .role-portal-shell .btn,.role-portal-shell button,.role-portal-shell select { min-height: 44px; }
        .role-portal-shell .btn.btn-primary,.role-portal-shell .role-period-filter button.is-active,.role-portal-shell .portal-client-nav a[aria-current='page'] { background:var(--eo-color-brand)!important; border-color:var(--eo-color-brand)!important; color:#fff!important; }
        .role-portal-shell .portal-client-nav { display:grid!important; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--eo-control-gap)!important; width:100%; }
        .role-portal-shell .role-summary-grid,.role-portal-shell .metric-grid { display:grid!important; gap:var(--eo-section-gap)!important; }
        .role-portal-shell .role-summary-grid { grid-template-columns:repeat(2,minmax(0,1fr))!important; }
        .role-portal-shell .metric-grid { grid-template-columns:repeat(3,minmax(0,1fr))!important; }
        .contractor-fixed-bottom-nav { display:none; }
        @media(max-width:640px){
          .app-role-banner { min-height: 60px; padding: var(--eo-space-3) var(--eo-space-4); border-radius: var(--eo-radius-control); }
          .app-role-banner-context { font-size: 11px; }
          .app-role-banner-name { font-size: 17px; }
        }
        @media(max-width:760px){
          .dashboard-shell { min-height: 100dvh; }
          .dashboard-shell-header {
            position: sticky !important;
            top: 0 !important;
            z-index: 100 !important;
            padding: max(8px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) 8px max(14px, env(safe-area-inset-left)) !important;
            background: #243f53 !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }
          .dashboard-shell > .main {
            min-height: calc(100dvh - 72px - env(safe-area-inset-top)) !important;
            padding-top: 14px !important;
            padding-bottom: max(20px, env(safe-area-inset-bottom)) !important;
            display: flex !important;
            flex-direction: column !important;
          }
          .dashboard-shell .app-page-content {
            flex: 0 0 auto;
            gap: 16px !important;
          }
          .dashboard-shell > .main > footer {
            margin-top: 20px !important;
          }
          .dashboard-shell .app-page-content > .everitt-cmd-trigger {
            position: relative !important;
            z-index: 2 !important;
            margin: 0 !important;
            background: #ffffff !important;
            color: #132433 !important;
            border: 1px solid #d5dee5 !important;
            box-shadow: 0 10px 24px rgba(19,36,51,.12) !important;
          }
          .dashboard-shell .app-page-content > .everitt-cmd-trigger * { color: #132433 !important; }
          .role-portal-shell .metric-grid,.role-portal-shell .role-summary-grid{grid-template-columns:minmax(0,1fr)!important}
          .role-portal-shell .portal-client-nav{grid-template-columns:repeat(2,minmax(0,1fr))}
          .role-portal-contractor > .main { padding-bottom: calc(92px + env(safe-area-inset-bottom)) !important; }
          .contractor-fixed-bottom-nav {
            position: fixed;
            left: 14px;
            right: 14px;
            bottom: max(10px, env(safe-area-inset-bottom));
            z-index: 101;
            display: grid;
            grid-template-columns: repeat(3,minmax(0,1fr));
            gap: 6px;
            padding: 7px;
            border: 1px solid rgba(36,63,83,.14);
            border-radius: 16px;
            background: #FFFFFF;
            box-shadow: 0 10px 28px rgba(18,40,56,.18);
          }
          .contractor-fixed-bottom-nav a {
            display: flex;
            min-height: 46px;
            align-items: center;
            justify-content: center;
            padding: 8px 6px;
            border-radius: 11px;
            color: #173044 !important;
            font-size: 13px;
            font-weight: 700;
            text-decoration: none;
          }
          .contractor-fixed-bottom-nav a:hover,.contractor-fixed-bottom-nav a:focus-visible { background: #edf3f6; color: #173044 !important; }
        }
        @media(max-width:480px){.role-portal-shell .portal-client-nav{grid-template-columns:minmax(0,1fr)}}
      `}</style>
    </div>
  );
}
