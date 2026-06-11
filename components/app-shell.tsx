'use client';

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
      <main id="main-content" className="main">
        {children}
      </main>
    </div>
  );
}
