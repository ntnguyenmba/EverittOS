'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppNavItems } from '@/components/app-nav-items';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { OrgSwitcher } from '@/components/org-switcher';
import { useTranslation } from '@/components/locale-provider';
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
  const router = useRouter();
  const { t } = useTranslation();
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

  async function logout() {
    const { performClientLogout } = await import('@/lib/client-logout');
    await performClientLogout(router);
  }

  return (
    <aside className="sidebar" aria-label="App navigation">
      <div className="sidebar-brand sidebar-brand-auth-like">
        <BrandLogo href={dashboardPathForRole(role)} size={28} showName />
      </div>

      <div className="sidebar-nav">
        <AppNavItems plan={normalized} role={role} unread={unread} />
      </div>

      <div className="sidebar-footer sidebar-single-nav-footer">
        <OrgSwitcher />
        <LanguageSwitcher id="sidebar-language" variant="compact" className="sidebar-language-compact" />
        <button type="button" className="sidebar-logout" onClick={() => void logout()}>{t('ux.logOut')}</button>
      </div>

      <style jsx global>{`
        .sidebar{display:flex;flex-direction:column}
        .sidebar-nav{flex:1 1 auto;min-height:0}
        .sidebar-single-nav-footer{display:grid;gap:10px;margin-top:auto;padding:14px}
        .sidebar-single-nav-footer .org-switcher,.sidebar-single-nav-footer .language-switcher{width:100%;min-width:0}
        .sidebar-single-nav-footer select{width:100%;min-height:44px}
        .sidebar-logout{width:100%;min-height:44px;border:1px solid #c9d2d8;border-radius:12px;background:#fff;color:#173044;font:inherit;font-weight:700;cursor:pointer}
      `}</style>
    </aside>
  );
}
