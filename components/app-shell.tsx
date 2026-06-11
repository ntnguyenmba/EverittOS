'use client';

import { AppHeader } from '@/components/app-header';
import { MobileNav } from '@/components/mobile-nav';
import { Sidebar } from '@/components/sidebar';
import type { EverittosPlan } from '@/lib/everittos-plans';
import type { UserRole } from '@/lib/roles';

type AppShellProps = {
  plan?: EverittosPlan | string | null;
  role?: UserRole | string | null;
  children: React.ReactNode;
};

export function AppShell({ plan, role, children }: AppShellProps) {
  return (
    <div className="dashboard-shell">
      <div className="dashboard-shell-mobile">
        <MobileNav plan={plan} role={role} />
      </div>
      <Sidebar plan={plan} role={role} />
      <div className="dashboard-shell-main">
        <AppHeader />
        <main id="main-content" className="main">
          {children}
        </main>
      </div>
    </div>
  );
}
