'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EVERITTOS_STRIPE_LINKS, isPaidEverittosPlan, normalizePlan, hasTeamManagement, type EverittosPlan } from '@/lib/everittos-plans';
import { supabase } from '@/lib/supabase';

const baseLinks = [
  ['Dashboard', '/dashboard'],
  ['Jobs', '/jobs'],
  ['Customers', '/customers'],
  ['Schedule', '/schedule'],
  ['Workers', '/workers'],
  ['Team', '/team'],
  ['Activity', '/activity'],
  ['Notifications', '/notifications'],
  ['Settings', '/settings']
] as const;

function planLabel(plan: EverittosPlan): string {
  if (plan === 'free') return 'Free';
  if (plan === 'pro') return 'Pro';
  if (plan === 'business') return 'Business';
  if (plan === 'starter') return 'Starter';
  if (plan === 'growth') return 'Growth';
  if (plan === 'enterprise') return 'Enterprise';
  return plan;
}

type SidebarProps = {
  plan?: EverittosPlan | string | null;
  showTeam?: boolean;
};

export function Sidebar({ plan = 'free' }: SidebarProps) {
  const router = useRouter();
  const normalized = normalizePlan(plan);

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-plan">
        <span className="sidebar-plan-label">Plan</span>
        <span className="plan-badge">{planLabel(normalized)}</span>
      </div>

      {baseLinks.map(([label, href]) => {
        if (href === '/team' && !hasTeamManagement(normalized)) return null;
        return (
          <Link key={href} href={href}>
            {label}
          </Link>
        );
      })}

      {!isPaidEverittosPlan(normalized) && (
        <div className="sidebar-upgrade">
          <p>Need unlimited jobs, photos, and reports?</p>
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
