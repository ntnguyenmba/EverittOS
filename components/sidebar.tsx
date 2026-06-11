'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  EVERITTOS_STRIPE_LINKS,
  isPaidEverittosPlan,
  normalizePlan,
  planDisplayName,
  type EverittosPlan
} from '@/lib/everittos-plans';
import { limitsForPlan } from '@/lib/everittos-limits';
import { canAccessNavHref } from '@/lib/nav-access';
import { isClientRole, isContractorRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

const baseLinks = [
  ['Dashboard', '/dashboard'],
  ['Jobs', '/jobs'],
  ['Customers', '/customers'],
  ['Schedule', '/schedule'],
  ['Workers', '/workers'],
  ['Team', '/team'],
  ['Activity', '/activity'],
  ['Workflows', '/workflows'],
  ['Notifications', '/notifications'],
  ['Billing', '/settings/billing'],
  ['Settings', '/settings']
] as const;

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
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function linkClass(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`) ? 'active' : undefined;
  }

  return (
    <aside className="sidebar" aria-label="App navigation">
      <div className="sidebar-plan">
        <span className="sidebar-plan-label">Plan</span>
        <span className="plan-badge">{planDisplayName(normalized)}</span>
      </div>

      {isClientRole(role) && limitsForPlan(normalized).clientPortal && (
        <Link href="/portal/client" aria-current={linkClass('/portal/client') ? 'page' : undefined}>
          Client portal
        </Link>
      )}
      {isContractorRole(role) && limitsForPlan(normalized).contractorPortal && (
        <Link href="/portal/contractor" aria-current={linkClass('/portal/contractor') ? 'page' : undefined}>
          Contractor portal
        </Link>
      )}

      {!isClientRole(role) &&
        baseLinks.map(([label, href]) => {
          if (!canAccessNavHref(role, href, normalized)) return null;
          return (
            <Link key={href} href={href} aria-current={linkClass(href) ? 'page' : undefined}>
              {label}
              {href === '/notifications' && unread > 0 ? ` (${unread})` : ''}
            </Link>
          );
        })}

      {!isPaidEverittosPlan(normalized) && canAccessNavHref(role, '/settings/billing', normalized) && (
        <div className="sidebar-upgrade">
          <p>Need more jobs, photos, or team members?</p>
          <a href={EVERITTOS_STRIPE_LINKS.pro} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            Start Pro
          </a>
          <Link href="/pricing" className="btn">
            Compare plans
          </Link>
        </div>
      )}

      <button className="btn sidebar-logout" type="button" onClick={logout}>
        Log out
      </button>
    </aside>
  );
}
