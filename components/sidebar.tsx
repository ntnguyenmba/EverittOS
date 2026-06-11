'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppNavItems } from '@/components/app-nav-items';
import {
  isPaidEverittosPlan,
  normalizePlan,
  planDisplayName,
  type EverittosPlan
} from '@/lib/everittos-plans';
import { canManageBilling } from '@/lib/roles';
import { canAccessNavHref } from '@/lib/nav-access';
import { isClientRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type SidebarProps = {
  plan?: EverittosPlan | string | null;
  role?: UserRole | string | null;
};

export function Sidebar({ plan = 'free', role: roleProp }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const normalized = normalizePlan(plan);
  const [unread, setUnread] = useState(0);
  const [role, setRole] = useState<UserRole>(normalizeRole(roleProp));

  useEffect(() => {
    if (roleProp) {
      setRole(normalizeRole(roleProp));
    }
  }, [roleProp]);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      if (!roleProp) {
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
  }, [roleProp]);

  async function logout() {
    const { performClientLogout } = await import('@/lib/client-logout');
    await performClientLogout(router);
  }

  const planBadge = <span className="plan-badge">{planDisplayName(normalized)}</span>;
  const showBillingLink = canManageBilling(role) && canAccessNavHref(role, '/settings/billing', normalized);

  return (
    <aside className="sidebar" aria-label="App navigation">
      <div className="sidebar-plan">
        <span className="sidebar-plan-label">Plan</span>
        {showBillingLink ? (
          <Link
            href="/settings/billing"
            className={`sidebar-plan-link${pathname.startsWith('/settings/billing') ? ' active' : ''}`}
            aria-current={pathname.startsWith('/settings/billing') ? 'page' : undefined}
          >
            {planBadge}
          </Link>
        ) : (
          planBadge
        )}
      </div>

      <AppNavItems plan={normalized} role={role} unread={unread} />

      {!isPaidEverittosPlan(normalized) && canManageBilling(role) && (
        <div className="sidebar-upgrade">
          <p>Need more jobs, photos, or team members?</p>
          <Link href="/settings/billing?upgrade=pro" className="btn btn-primary">
            Start Pro
          </Link>
        </div>
      )}

      <button className="btn sidebar-logout" type="button" onClick={logout}>
        Log out
      </button>
    </aside>
  );
}
