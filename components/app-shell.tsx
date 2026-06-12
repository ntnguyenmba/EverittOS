'use client';

import { useState } from 'react';
import { AskEverittCommand } from '@/components/ask-everitt-command';
import { AppFooter } from '@/components/app-footer';
import { AppNavigationTracker } from '@/components/app-navigation-tracker';
import { AppPageContent } from '@/components/app-page-content';
import { AppPageTop } from '@/components/app-page-top';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { MobileNav } from '@/components/mobile-nav';
import { Sidebar } from '@/components/sidebar';
import { isClientRole, normalizeRole } from '@/lib/roles';
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
  const normalizedRole = normalizeRole(role);
  const showAi = !isClientRole(normalizedRole);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className={className ? `dashboard-shell ${className}` : 'dashboard-shell'}>
      <AppNavigationTracker />
      <div className="dashboard-shell-mobile">
        <MobileNav plan={plan} role={role} moreOpen={moreOpen} onMoreOpenChange={setMoreOpen} />
      </div>
      <Sidebar plan={plan} role={role} />
      <main id="main-content" className="main">
        <AppPageTop role={role} showBackButton={showBackButton} />
        <AppPageContent>
          {showAi ? <AskEverittCommand plan={plan} /> : null}
          {children}
        </AppPageContent>
        <AppFooter />
      </main>
      <MobileBottomNav role={role} onMore={() => setMoreOpen(true)} />
    </div>
  );
}
