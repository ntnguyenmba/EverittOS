'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useTranslation } from '@/components/locale-provider';
import { settingsLinksForRole } from '@/lib/nav-access';
import { settingsNavLabel } from '@/lib/nav-i18n';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type SettingsShellProps = {
  plan?: EverittosPlan;
  title: string;
  description?: string;
  role?: UserRole | string | null;
  children: React.ReactNode;
};

export function SettingsShell({ plan = 'free', title, description, role: roleProp, children }: SettingsShellProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
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

    loadRole();
  }, [roleProp]);

  const links = settingsLinksForRole(role, normalizedPlan);

  return (
    <AppShell plan={normalizedPlan} role={role}>
      <div className="page-head">
        <div>
          <h2>{title}</h2>
          {description ? <p className="muted">{description}</p> : null}
        </div>
      </div>

      <nav className="settings-subnav settings-subnav-pills" aria-label="Settings">
        {links.map((link) => {
          const active =
            link.href === '/settings'
              ? pathname === '/settings'
              : link.href === '/settings/people'
                ? pathname === '/settings/people' ||
                  pathname.startsWith('/settings/people/') ||
                  pathname === '/settings/team' ||
                  pathname.startsWith('/settings/team/')
                : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link key={link.href} href={link.href} className={active ? 'active' : undefined}>
              {settingsNavLabel(link.href, t, link.label)}
            </Link>
          );
        })}
      </nav>

      {children}
    </AppShell>
  );
}
