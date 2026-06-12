'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppNavItems } from '@/components/app-nav-items';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
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
};

export function MobileNav({ plan = 'free', role: roleProp }: MobileNavProps) {
  const pathname = usePathname() || '/';
  const hideUpgradeCta = pathname.startsWith('/settings/billing');
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const normalized = normalizePlan(plan);
  const [role, setRole] = useState<UserRole>(normalizeRole(roleProp));
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

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
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      document.body.classList.remove('mobile-nav-open');
      return;
    }
    document.body.classList.add('mobile-nav-open');
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('mobile-nav-open');
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function logout() {
    setOpen(false);
    const { performClientLogout } = await import('@/lib/client-logout');
    await performClientLogout(router);
  }

  const showBillingLink = canManageBilling(role);

  const drawer = open ? (
    <div className="mobile-nav-overlay mobile-nav-overlay-portal" role="presentation" onClick={() => setOpen(false)}>
      <nav
        id="mobile-nav-panel"
        className="mobile-nav-drawer"
        aria-label={t('ux.mobileNavLabel')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mobile-nav-drawer-head">
          <strong>{t('ux.appName')}</strong>
          <button type="button" className="btn btn-sm mobile-nav-close-btn" onClick={() => setOpen(false)}>
            {t('common.close')}
          </button>
        </div>

        <div className="mobile-nav-drawer-language">
          <LanguageSwitcher id="mobile-drawer-language" variant="drawer" />
        </div>

        {showBillingLink ? (
          <p className="mobile-nav-plan">
            <Link
              href="/settings/billing"
              className={isNavLinkActive(pathname, '/settings/billing') ? 'active' : undefined}
              onClick={() => setOpen(false)}
            >
              {planDisplayName(normalized)}
            </Link>
          </p>
        ) : (
          <p className="mobile-nav-plan">
            <strong>{planDisplayName(normalized)}</strong>
          </p>
        )}

        <div className="mobile-nav-panel">
          <AppNavItems
            plan={normalized}
            role={role}
            unread={unread}
            linkClassName="mobile-nav-drawer-link"
            onNavigate={() => setOpen(false)}
          />
        </div>

        {!hideUpgradeCta && !isPaidEverittosPlan(normalized) && canManageBilling(role) ? (
          <Link
            href="/settings/billing?upgrade=pro"
            className="btn btn-primary btn-block mobile-nav-drawer-cta"
            onClick={() => setOpen(false)}
          >
            {t('ux.startPro')}
          </Link>
        ) : null}

        {!isClientRole(role) ? (
          <button className="btn btn-block mobile-nav-logout" type="button" onClick={() => void logout()}>
            {t('ux.logOut')}
          </button>
        ) : null}
      </nav>
    </div>
  ) : null;

  return (
    <header className={`mobile-nav${open ? ' mobile-nav-open' : ''}`} aria-label={t('ux.mobileNavLabel')}>
      <div className="mobile-nav-bar">
        <BrandLogo href="/dashboard" size={28} showName className="mobile-nav-brand-logo" />
        <div className="mobile-nav-bar-actions">
          <LanguageSwitcher id="mobile-header-language" variant="compact" className="mobile-nav-language" />
          <button
            type="button"
            className="mobile-nav-menu-btn"
            aria-expanded={open}
            aria-controls="mobile-nav-panel"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="mobile-nav-menu-icon" aria-hidden="true" />
            <span className="sr-only">{open ? t('common.close') : t('nav.more')}</span>
          </button>
        </div>
      </div>

      {mounted && drawer ? createPortal(drawer, document.body) : null}
    </header>
  );
}
