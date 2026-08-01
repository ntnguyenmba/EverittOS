'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { isNavLinkActive, settingsLinksForRole, type SettingsNavLink } from '@/lib/nav-access';
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
  '/settings/billing': 'Billing'
};

function addLinkOnce(links: SettingsNavLink[], link: SettingsNavLink, afterHref?: string): SettingsNavLink[] {
  if (links.some((item) => item.href === link.href)) return links;
  if (!afterHref) return [...links, link];
  const index = links.findIndex((item) => item.href === afterHref);
  if (index < 0) return [...links, link];
  return [...links.slice(0, index + 1), link, ...links.slice(index + 1)];
}

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

  const links = useMemo(() => {
    let next = settingsLinksForRole(role, normalizedPlan).map((link) => ({
      ...link,
      label: CLEAR_SETTINGS_LABELS[link.href] || link.label
    }));

    if (canViewTeam(role)) {
      next = addLinkOnce(next, { href: '/settings/team', label: 'Team' }, '/settings');
    }

    if (canManageBilling(role)) {
      next = addLinkOnce(next, { href: '/settings/billing', label: 'Billing' }, '/settings/team');
    }

    return next;
  }, [normalizedPlan, role]);

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
