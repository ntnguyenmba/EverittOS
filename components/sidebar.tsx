'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppNavItems } from '@/components/app-nav-items';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useTranslation } from '@/components/locale-provider';
import { SidebarPlanCard } from '@/components/sidebar-plan-card';
import { useWorkspacePlanOptional } from '@/components/workspace-plan-provider';
import { isPaidEverittosPlan, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { dashboardPathForRole } from '@/lib/dashboard-nav';
import { canManageBilling } from '@/lib/roles';
import { canAccessNavHref } from '@/lib/nav-access';
import { isClientRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type SidebarProps = {
  plan?: EverittosPlan | string | null;
  role?: UserRole | string | null;
};

export function Sidebar({ plan, role: roleProp }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const hideUpgradeCta = pathname.startsWith('/settings/billing');
  const { t } = useTranslation();
  const workspacePlan = useWorkspacePlanOptional();
  const normalized = normalizePlan(workspacePlan?.plan ?? plan);
  const resolvedRole = workspacePlan?.role ?? normalizeRole(roleProp);
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
    load();
  }, [roleProp, workspacePlan?.role]);

  async function logout() {
    const { performClientLogout } = await import('@/lib/client-logout');
    await performClientLogout(router);
  }

  const showBillingLink = canManageBilling(role) && canAccessNavHref(role, '/settings/billing', normalized);
  const showUpgrade = !hideUpgradeCta && !isPaidEverittosPlan(normalized) && canManageBilling(role);
  const showViewPlans = !hideUpgradeCta && isPaidEverittosPlan(normalized) && canManageBilling(role);
  const isOwnerDashboard = pathname === '/dashboard' && role === 'owner';

  return (
    <aside className={isOwnerDashboard ? 'sidebar sidebar-owner-dashboard' : 'sidebar'} aria-label="App navigation">
      <div className="sidebar-brand">
        <BrandLogo href={dashboardPathForRole(role)} size={28} showName />
      </div>

      <div className="sidebar-nav">
        <AppNavItems plan={normalized} role={role} unread={unread} />
      </div>

      <div className="sidebar-footer">
        <SidebarPlanCard
          plan={normalized}
          showBillingLink={showBillingLink}
          showUpgrade={showUpgrade}
          showViewPlans={showViewPlans}
          billingActive={pathname.startsWith('/settings/billing')}
        />
        <div className="sidebar-footer-actions">
          <LanguageSwitcher id="sidebar-language" variant="compact" className="sidebar-language-compact" />
          <button className="btn btn-sm sidebar-logout" type="button" onClick={logout}>
            {t('ux.logOut')}
          </button>
        </div>
      </div>
    </aside>
  );
}
