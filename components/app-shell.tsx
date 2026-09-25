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
  </div>;
}
