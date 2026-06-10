'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  EVERITTOS_STRIPE_LINKS,
  isPaidEverittosPlan,
  normalizePlan,
  hasTeamManagement,
  planDisplayName,
  type EverittosPlan
} from '@/lib/everittos-plans';
import { limitsForPlan } from '@/lib/everittos-limits';
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
  const normalized = normalizePlan(plan);
  const [unread, setUnread] = useState(0);
  const [role, setRole] = useState<UserRole>(normalizeRole(roleProp));

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

  return (
    <aside className="sidebar">
      <div className="sidebar-plan">
        <span className="sidebar-plan-label">Plan</span>
        <span className="plan-badge">{planDisplayName(normalized)}</span>
      </div>

      {isClientRole(role) && limitsForPlan(normalized).clientPortal && (
        <Link href="/portal/client">Client portal</Link>
      )}
      {isContractorRole(role) && limitsForPlan(normalized).contractorPortal && (
        <Link href="/portal/contractor">Contractor portal</Link>
      )}

      {!isClientRole(role) &&
        baseLinks.map(([label, href]) => {
          if (href === '/team' && !hasTeamManagement(normalized)) return null;
          if (href === '/activity' && !limitsForPlan(normalized).activityLog) return null;
          if (href === '/workflows' && !limitsForPlan(normalized).workflowCustomization) return null;
          return (
            <Link key={href} href={href}>
              {label}
              {href === '/notifications' && unread > 0 ? ` (${unread})` : ''}
            </Link>
          );
        })}

      {!isPaidEverittosPlan(normalized) && (
        <div className="sidebar-upgrade">
          <p>Need more jobs, photos, and team capacity?</p>
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
