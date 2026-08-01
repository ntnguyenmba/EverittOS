'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { isNavLinkActive, settingsLinksForRole } from '@/lib/nav-access';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canManageBilling, canViewTeam, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type SettingsShellProps = {
  plan?: EverittosPlan;
  title: string;
  description?: string;
  role?: UserRole | string | null;
  children: React.ReactNode;
};

const CLEAR_SETTINGS_LABELS: Record<string, string> = {
  '/settings/account': 'Account',
  '/settings': 'Organization',
  '/settings/team': 'Team',
  '/settings/people': 'Team',
  '/settings/notifications': 'Notifications',
  '/settings/branding': 'Preferences',
  '/settings/privacy': 'Privacy',
  '/terms': 'Terms',
  '/settings/privacy#delete-account': 'Delete Account',
  '/settings/billing': 'Billing',
  '/about': 'About'
};

export function SettingsShell({ plan = 'free', title, description, role: roleProp, children }: SettingsShellProps) {
  const pathname = usePathname();
  const normalizedPlan = normalizePlan(plan);
  const [role, setRole] = useState<UserRole>(normalizeRole(roleProp));

  useEffect(() => {
    if (roleProp) {
      setRole(normalizeRole(roleProp));
      return;
    }

    async function loadRole() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      setRole(normalizeRole(profile?.role));
    }

    void loadRole();
  }, [roleProp]);

  const links = settingsLinksForRole(role, normalizedPlan).map((link) => ({
    ...link,
    label: CLEAR_SETTINGS_LABELS[link.href] || link.label
  }));

  if (canViewTeam(role) && !links.some((link) => link.href === '/settings/team')) {
    const organizationIndex = links.findIndex((link) => link.href === '/settings');
    const teamLink = { href: '/settings/team', label: 'Team' };
    if (organizationIndex >= 0) links.splice(organizationIndex + 1, 0, teamLink);
    else links.push(teamLink);
  }

  if (canManageBilling(role) && !links.some((link) => link.href === '/settings/billing')) {
    links.push({ href: '/settings/billing', label: 'Billing' });
  }

  if (!links.some((link) => link.href === '/about')) {
    links.push({ href: '/about', label: 'About' });
  }

  const showBillingShortcut = canManageBilling(role) && pathname !== '/settings/billing';

  return (
    <AppShell plan={normalizedPlan} role={role}>
      <div className="page-head">
        <div>
          <h2>{title}</h2>
          {description ? <p className="muted">{description}</p> : null}
        </div>
        {showBillingShortcut ? (
          <Link className="btn" href="/settings/billing">
            Manage Billing
          </Link>
        ) : null}
      </div>

      <nav className="settings-subnav settings-subnav-pills" aria-label="Settings">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={isNavLinkActive(pathname, link.href) ? 'active' : undefined}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {children}
    </AppShell>
  );
}
