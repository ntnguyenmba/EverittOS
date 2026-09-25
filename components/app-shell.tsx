'use client';

import { AskEverittCommand } from '@/components/ask-everitt-command';
import { AppFooter } from '@/components/app-footer';
import { AppNavigationTracker } from '@/components/app-navigation-tracker';
import { AppPageContent } from '@/components/app-page-content';
import { MobileNav } from '@/components/mobile-nav';
import { OfflineSyncManager } from '@/components/offline-sync-manager';
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

function roleBannerKind(role: UserRole): RoleBannerKind {
  if (role === 'client') return 'client';
  if (role === 'contractor' || role === 'employee' || role === 'viewer') return 'worker';
  return 'owner';
}

function RoleContextBanner({ role }: { role: UserRole }) {
  const { locale } = useTranslation();
  const copy = ROLE_BANNER_COPY[locale] ?? ROLE_BANNER_COPY.en;
  const kind = roleBannerKind(role);
  return <section className={`app-role-banner app-role-banner-${kind}`} aria-label={`${copy.context}: ${copy[kind]}`}><span className="app-role-banner-context">{copy.context}</span><strong className="app-role-banner-name">{copy[kind]}</strong></section>;
}

type AppShellProps = { plan?: EverittosPlan | string | null; role?: UserRole | string | null; showBackButton?: boolean; className?: string; children: React.ReactNode };

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
  const rolePortalClass = isContractorPortal ? ' role-portal-shell role-portal-contractor' : isClientPortal ? ' role-portal-shell role-portal-client' : '';
  const shellClass = ['dashboard-shell', 'shared-hamburger-shell', rolePortalClass.trim(), className].filter(Boolean).join(' ');

  return <div className={shellClass}>
    <UnsavedChangesGuard />
    <AppNavigationTracker />
    <OfflineSyncManager />
    <Sidebar plan={resolvedPlan} role={resolvedRole} />
    <header className="dashboard-shell-header"><MobileNav plan={resolvedPlan} role={resolvedRole} /></header>
    <main id="main-content" className="main"><AppPageContent><AskEverittCommand plan={resolvedPlan} embedded={false} showTrigger={showAi} />{roleSource ? <RoleContextBanner role={resolvedRole} /> : null}{children}</AppPageContent><AppFooter /></main>
    <style jsx global>{`
      .app-role-banner{width:100%!important;min-width:0!important;min-height:68px;margin:0!important;padding:var(--eo-space-4) var(--eo-space-5);display:flex;align-items:center;justify-content:space-between;gap:var(--eo-space-4);box-sizing:border-box;border:1px solid var(--eo-role-banner-border);border-radius:var(--eo-radius-card);background:var(--eo-color-brand);color:var(--eo-color-on-brand);box-shadow:var(--eo-shadow-card)}
      .app-role-banner-context{min-width:0;color:var(--eo-role-banner-context)!important;font-size:12px;font-weight:700;line-height:1.3;letter-spacing:.055em;text-transform:uppercase}.app-role-banner-name{color:var(--eo-color-on-brand)!important;font-size:18px;font-weight:800;line-height:1.2;text-align:right}.dashboard-shell .contractor-role-label{display:none!important}.dashboard-shell .language-switcher{display:grid;gap:5px;min-width:0}.dashboard-shell .language-switcher-label{display:block;line-height:1.25}.dashboard-shell .language-switcher-select{line-height:1.25;padding-left:12px;padding-right:32px;white-space:nowrap}.dashboard-shell .owner-home-primary{display:grid!important;gap:var(--eo-control-gap)!important}.dashboard-shell .owner-home-primary>*{margin-top:0!important;margin-bottom:0!important}.dashboard-shell .owner-home-kicker{display:block!important;line-height:1.35!important}.dashboard-shell .owner-home-primary h2{line-height:1.3!important;overflow-wrap:anywhere}.dashboard-shell .owner-home-primary p{line-height:1.55!important;overflow-wrap:anywhere}.dashboard-shell .owner-home-actions{display:flex!important;flex-wrap:wrap!important;gap:var(--eo-control-gap)!important;padding-top:4px}.role-portal-shell .btn,.role-portal-shell button,.role-portal-shell select{min-height:44px}.role-portal-shell .btn.btn-primary,.role-portal-shell .role-period-filter button.is-active,.role-portal-shell .portal-client-nav a[aria-current='page']{background:var(--eo-color-brand)!important;border-color:var(--eo-color-brand)!important;color:var(--eo-color-on-brand)!important}.role-portal-shell .portal-client-nav{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--eo-control-gap)!important;width:100%}.role-portal-shell .role-summary-grid,.role-portal-shell .metric-grid{display:grid!important;gap:var(--eo-section-gap)!important}.role-portal-shell .role-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.role-portal-shell .metric-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      @media(max-width:640px){.app-role-banner{min-height:60px;padding:var(--eo-space-3) var(--eo-space-4);border-radius:var(--eo-radius-control)}.app-role-banner-context{font-size:11px}.app-role-banner-name{font-size:17px}}
      @media(max-width:760px){.dashboard-shell .app-page-content>.everitt-cmd-trigger{position:relative!important;z-index:2!important;margin:0!important;background:var(--eo-color-surface)!important;color:var(--eo-color-text)!important;border:1px solid var(--eo-color-border)!important;box-shadow:var(--eo-command-shadow)!important;transform:none!important}.dashboard-shell .app-page-content>.everitt-cmd-trigger *{color:var(--eo-color-text)!important}.role-portal-shell .metric-grid,.role-portal-shell .role-summary-grid{grid-template-columns:minmax(0,1fr)!important}.role-portal-shell .portal-client-nav{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:480px){.role-portal-shell .portal-client-nav{grid-template-columns:minmax(0,1fr)}}
    `}</style>
  </div>;
}
