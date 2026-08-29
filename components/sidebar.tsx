'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppNavItems } from '@/components/app-nav-items';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useWorkspacePlanOptional } from '@/components/workspace-plan-provider';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { dashboardPathForRole } from '@/lib/dashboard-nav';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type SidebarProps = {
  plan?: EverittosPlan | string | null;
  role?: UserRole | string | null;
};

export function Sidebar({ plan, role: roleProp }: SidebarProps) {
  const pathname = usePathname() || '/';
  const workspacePlan = useWorkspacePlanOptional();
  const normalized = normalizePlan(workspacePlan?.plan ?? plan);
  const resolvedRole = roleProp != null ? normalizeRole(roleProp) : normalizeRole(workspacePlan?.role);
  const [unread, setUnread] = useState(0);
  const [role, setRole] = useState<UserRole>(resolvedRole);

  useEffect(() => {
    setRole(resolvedRole);
  }, [resolvedRole]);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      if (!roleProp && !workspacePlan?.role) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
        setRole(normalizeRole(profile?.role));
      }
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null);
      setUnread(count || 0);
    }
    void load();
  }, [roleProp, workspacePlan?.role]);

  const isOwnerDashboard = pathname === '/dashboard' && role === 'owner';

  return (
    <aside className={isOwnerDashboard ? 'sidebar sidebar-owner-dashboard' : 'sidebar'} aria-label="App navigation">
      <div className="sidebar-brand sidebar-brand-auth-like">
        <BrandLogo href={dashboardPathForRole(role)} size={28} showName />
        <LanguageSwitcher id="sidebar-language" variant="compact" className="sidebar-language-compact" />
      </div>

      <div className="sidebar-nav">
        <AppNavItems plan={normalized} role={role} unread={unread} />
      </div>
    </aside>
  );
}
