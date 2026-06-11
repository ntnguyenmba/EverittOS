'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppNavItems } from '@/components/app-nav-items';
import {
  isPaidEverittosPlan,
  normalizePlan,
  planDisplayName,
  type EverittosPlan
} from '@/lib/everittos-plans';
import { canManageBilling } from '@/lib/roles';
import { isNavLinkActive } from '@/lib/nav-access';
import { isClientRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type MobileNavProps = {
  plan?: EverittosPlan | string | null;
  role?: UserRole | string | null;
};

export function MobileNav({ plan = 'free', role: roleProp }: MobileNavProps) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const normalized = normalizePlan(plan);
  const [role, setRole] = useState<UserRole>(normalizeRole(roleProp));
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (roleProp) {
      setRole(normalizeRole(roleProp));
    }
  }, [roleProp]);

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

  async function logout() {
    const { performClientLogout } = await import('@/lib/client-logout');
    await performClientLogout(router);
  }

  const showBillingLink = canManageBilling(role);

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
            Plan:{' '}
            {showBillingLink ? (
              <Link
                href="/settings/billing"
                className={isNavLinkActive(pathname, '/settings/billing') ? 'active' : undefined}
              >
                <strong>{planDisplayName(normalized)}</strong>
              </Link>
            ) : (
              <strong>{planDisplayName(normalized)}</strong>
            )}
          </p>

          <AppNavItems
            plan={normalized}
            role={role}
            unread={unread}
            onNavigate={() => setOpen(false)}
          />

          {!isPaidEverittosPlan(normalized) && canManageBilling(role) ? (
            <Link href="/settings/billing?upgrade=pro" className="btn btn-primary" onClick={() => setOpen(false)}>
              Start Pro
            </Link>
          ) : null}

          {!isClientRole(role) ? (
            <button className="btn mobile-nav-logout" type="button" onClick={logout}>
              Log out
            </button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
