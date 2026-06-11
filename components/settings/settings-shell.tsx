'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import type { EverittosPlan } from '@/lib/everittos-plans';

const SETTINGS_LINKS = [
  { href: '/settings', label: 'Company' },
  { href: '/settings/account', label: 'Account' },
  { href: '/settings/billing', label: 'Billing' },
  { href: '/settings/security', label: 'Security' },
  { href: '/settings/api', label: 'API' },
  { href: '/settings/departments', label: 'Departments' }
] as const;

type SettingsShellProps = {
  plan: EverittosPlan;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function SettingsShell({ plan, title, description, children }: SettingsShellProps) {
  const pathname = usePathname();

  return (
    <AppShell plan={plan}>
        <div className="page-head">
          <div>
            <h2>{title}</h2>
            {description ? <p className="muted">{description}</p> : null}
          </div>
        </div>

        <nav className="settings-subnav" aria-label="Settings">
          {SETTINGS_LINKS.map((link) => {
            const active =
              link.href === '/settings'
                ? pathname === '/settings'
                : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link key={link.href} href={link.href} className={active ? 'active' : undefined}>
                {link.label}
              </Link>
            );
          })}
        </nav>

        {children}
    </AppShell>
  );
}
