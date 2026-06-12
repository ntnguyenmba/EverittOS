'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppNavItems } from '@/components/app-nav-items';
import { useTranslation } from '@/components/locale-provider';
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
  moreOpen?: boolean;
  onMoreOpenChange?: (open: boolean) => void;
};

export function MobileNav({ plan = 'free', role: roleProp, moreOpen, onMoreOpenChange }: MobileNavProps) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = moreOpen ?? internalOpen;
  const setOpen = onMoreOpenChange ?? setInternalOpen;
  const normalized = normalizePlan(plan);
  const [role, setRole] = useState<UserRole>(normalizeRole(roleProp));
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (roleProp) setRole(normalizeRole(roleProp));
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
  }, [pathname, setOpen]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  async function logout() {
    const { performClientLogout } = await import('@/lib/client-logout');
    await performClientLogout(router);
  }

  const showBillingLink = canManageBilling(role);

  return (
    <div className="mobile-nav">
      <div className="mobile-nav-bar">
        <span className="mobile-nav-brand">{t('ux.appName')}</span>
        <p className="mobile-nav-plan">
          {showBillingLink ? (
            <Link
              href="/settings/billing"
              className={isNavLinkActive(pathname, '/settings/billing') ? 'active' : undefined}
            >
              {planDisplayName(normalized)}
            </Link>
          ) : (
            <strong>{planDisplayName(normalized)}</strong>
          )}
        </p>
      </div>

      {open ? (
        <div className="mobile-nav-overlay" role="presentation" onClick={() => setOpen(false)}>
          <nav
            id="mobile-nav-panel"
            className="mobile-nav-drawer"
            aria-label={t('ux.mobileNavLabel')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-nav-drawer-head">
              <strong>{t('nav.more')}</strong>
              <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
                {t('common.close')}
              </button>
            </div>

            <AppNavItems plan={normalized} role={role} unread={unread} onNavigate={() => setOpen(false)} />

            {!isPaidEverittosPlan(normalized) && canManageBilling(role) ? (
              <Link href="/settings/billing?upgrade=pro" className="btn btn-primary btn-block" onClick={() => setOpen(false)}>
                {t('ux.startPro')}
              </Link>
            ) : null}

            {!isClientRole(role) ? (
              <button className="btn btn-block mobile-nav-logout" type="button" onClick={logout}>
                {t('ux.logOut')}
              </button>
            ) : null}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
