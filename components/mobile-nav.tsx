'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  EVERITTOS_STRIPE_LINKS,
  hasTeamManagement,
  isPaidEverittosPlan,
  normalizePlan,
  planDisplayName,
  type EverittosPlan
} from '@/lib/everittos-plans';
import { limitsForPlan } from '@/lib/everittos-limits';
import { isClientRole, isContractorRole, normalizeRole, type UserRole } from '@/lib/roles';

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

type MobileNavProps = {
  plan?: EverittosPlan | string | null;
  role?: UserRole | string | null;
};

export function MobileNav({ plan = 'free', role: roleProp }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const normalized = normalizePlan(plan);
  const role = normalizeRole(roleProp);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const links = baseLinks.filter(([label, href]) => {
    if (href === '/team' && !hasTeamManagement(normalized)) return false;
    if (href === '/activity' && !limitsForPlan(normalized).activityLog) return false;
    if (href === '/workflows' && !limitsForPlan(normalized).workflowCustomization) return false;
    return true;
  });

  return (
    <div className="mobile-nav">
      <button
        type="button"
        className="btn mobile-nav-toggle"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Close menu' : 'Menu'}
      </button>

      {open ? (
        <nav id="mobile-nav-panel" className="mobile-nav-panel" aria-label="App navigation">
          <p className="mobile-nav-plan">
            Plan: <strong>{planDisplayName(normalized)}</strong>
          </p>
          {isClientRole(role) && limitsForPlan(normalized).clientPortal ? (
            <Link href="/portal/client" className={pathname.startsWith('/portal/client') ? 'active' : ''}>
              Client portal
            </Link>
          ) : null}
          {isContractorRole(role) && limitsForPlan(normalized).contractorPortal ? (
            <Link href="/portal/contractor" className={pathname.startsWith('/portal/contractor') ? 'active' : ''}>
              Contractor portal
            </Link>
          ) : null}
          {!isClientRole(role) &&
            links.map(([label, href]) => (
              <Link key={href} href={href} className={pathname === href || pathname.startsWith(`${href}/`) ? 'active' : ''}>
                {label}
              </Link>
            ))}
          {!isPaidEverittosPlan(normalized) ? (
            <a href={EVERITTOS_STRIPE_LINKS.pro} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              Start Pro
            </a>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
