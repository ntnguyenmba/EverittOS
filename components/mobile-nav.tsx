'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
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
  ['Analytics', '/analytics'],
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
  const [role, setRole] = useState<UserRole>(normalizeRole(roleProp));

  useEffect(() => {
    if (roleProp) {
      setRole(normalizeRole(roleProp));
    }
  }, [roleProp]);

  useEffect(() => {
    async function loadRole() {
      if (roleProp) return;
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      setRole(normalizeRole(profile?.role));
    }
    loadRole();
  }, [roleProp]);

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

  const links = baseLinks.filter(([, href]) => canAccessNavHref(role, href, normalized));

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
          {!isPaidEverittosPlan(normalized) && canAccessNavHref(role, '/settings/billing', normalized) ? (
            <a href={EVERITTOS_STRIPE_LINKS.pro} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              Start Pro
            </a>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
