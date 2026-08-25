'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';
import { useWorkspacePlanOptional } from '@/components/workspace-plan-provider';
import { dashboardPathForRole } from '@/lib/dashboard-nav';
import { navLabel } from '@/lib/nav-i18n';
import { CLIENT_PORTAL_HOME, CLIENT_PORTAL_SETTINGS, CONTRACTOR_PORTAL_HOME, CONTRACTOR_PORTAL_SETTINGS } from '@/lib/portal-access';
import { isClientRole, isContractorRole, normalizeRole } from '@/lib/roles';

const HIDDEN_PREFIXES = ['/login', '/signup', '/auth', '/onboarding', '/pricing', '/privacy', '/terms', '/cookies', '/disclaimer', '/security', '/book'];

function Icon({ name }: { name: 'home' | 'jobs' | 'customers' | 'calendar' | 'more' | 'money' | 'account' }) {
  const common = { width: 23, height: 23, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'home') return <svg {...common}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/></svg>;
  if (name === 'jobs') return <svg {...common}><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6V4h8v2M3 11h18M10 11v2h4v-2"/></svg>;
  if (name === 'customers') return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.4-4 2.3-6 5.5-6s5.1 2 5.5 6"/><path d="M16 8.5a2.5 2.5 0 1 0 0-5M16 14c2.7.2 4.2 2.1 4.5 5"/></svg>;
  if (name === 'calendar') return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>;
  if (name === 'money') return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M7 9H5v2M17 15h2v-2"/></svg>;
  if (name === 'account') return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.7-4.2 3.2-6.5 7.5-6.5s6.8 2.3 7.5 6.5"/></svg>;
  return <svg {...common}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></svg>;
}

function activeFor(pathname: string, href: string) {
  const path = href.split(/[?#]/)[0];
  if (path === '/dashboard' || path === CLIENT_PORTAL_HOME || path === CONTRACTOR_PORTAL_HOME) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function MobileBottomNav() {
  const pathname = usePathname() || '/';
  const { t, locale } = useTranslation();
  const workspace = useWorkspacePlanOptional();
  const role = normalizeRole(workspace?.role);

  if (HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return null;
  if (!workspace?.plan && !workspace?.role) return null;

  const links = isClientRole(role)
    ? [
        { href: CLIENT_PORTAL_HOME, label: t('portal.common.overview'), icon: 'home' as const },
        { href: `${CLIENT_PORTAL_HOME}?tab=jobs`, label: t('portal.common.appointments'), icon: 'jobs' as const },
        { href: CLIENT_PORTAL_SETTINGS, label: t('portal.common.account'), icon: 'account' as const }
      ]
    : isContractorRole(role)
      ? [
          { href: CONTRACTOR_PORTAL_HOME, label: t('portal.contractor.nav.dashboard'), icon: 'home' as const },
          { href: `${CONTRACTOR_PORTAL_HOME}#current-jobs`, label: t('portal.contractor.nav.jobs'), icon: 'jobs' as const },
          { href: `${CONTRACTOR_PORTAL_HOME}#history`, label: t('portal.contractor.nav.earnings'), icon: 'money' as const },
          { href: CONTRACTOR_PORTAL_SETTINGS, label: t('portal.contractor.nav.settings'), icon: 'account' as const }
        ]
      : [
          { href: dashboardPathForRole(role), label: navLabel('/dashboard', t, 'Home', locale), icon: 'home' as const },
          { href: '/jobs', label: navLabel('/jobs', t, 'Jobs', locale), icon: 'jobs' as const },
          { href: '/customers', label: navLabel('/customers', t, 'Customers', locale), icon: 'customers' as const },
          { href: '/schedule', label: navLabel('/schedule', t, 'Calendar', locale), icon: 'calendar' as const },
          { href: '/settings', label: navLabel('/settings', t, 'More', locale), icon: 'more' as const }
        ];

  return <nav className={`everitt-bottom-nav everitt-bottom-nav-${links.length}`} aria-label={t('ux.mobileNavLabel')}>
    {links.map((item) => {
      const active = activeFor(pathname, item.href);
      return <Link key={item.href} href={item.href} className={`everitt-bottom-nav-item${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
        <span className="everitt-bottom-nav-icon"><Icon name={item.icon} /></span>
        <span className="everitt-bottom-nav-label">{item.label}</span>
      </Link>;
    })}
  </nav>;
}
