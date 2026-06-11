'use client';

import { AppFooter } from '@/components/app-footer';
import { AppNavigationTracker } from '@/components/app-navigation-tracker';
import { AppPageTop } from '@/components/app-page-top';
import { MobileNav } from '@/components/mobile-nav';
import { Sidebar } from '@/components/sidebar';
import type { EverittosPlan } from '@/lib/everittos-plans';
import type { UserRole } from '@/lib/roles';

type AppShellProps = {
  plan?: EverittosPlan | string | null;
  role?: UserRole | string | null;
  showBackButton?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function AppShell({ plan, role, showBackButton = true, className, children }: AppShellProps) {
  return (
    <div className={className ? `dashboard-shell ${className}` : 'dashboard-shell'}>
      <AppNavigationTracker />
      <div className="dashboard-shell-mobile">
        <MobileNav plan={plan} role={role} />
      </div>
      <Sidebar plan={plan} role={role} />
      <main id="main-content" className="main">
        <AppPageTop role={role} showBackButton={showBackButton} />
        {children}
        <AppFooter />
      </main>
    </div>
  );
}
