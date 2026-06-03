'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EVERITTOS_STRIPE_LINKS, isPaidEverittosPlan, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { supabase } from '@/lib/supabase';

const links = [
  ['Dashboard', '/dashboard'],
  ['Jobs', '/jobs'],
  ['Customers', '/customers'],
  ['Schedule', '/schedule'],
  ['Workers', '/workers'],
  ['Settings', '/settings']
] as const;

type SidebarProps = {
  plan?: EverittosPlan | string | null;
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
        <span className="plan-badge">{normalized === 'free' ? 'Free' : normalized === 'pro' ? 'Pro' : 'Business'}</span>
      </div>

      {links.map(([label, href]) => (
        <Link key={href} href={href}>
          {label}
        </Link>
      ))}

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
