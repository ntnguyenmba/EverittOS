'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppNavItems } from '@/components/app-nav-items';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useTranslation } from '@/components/locale-provider';
import { SidebarPlanCard } from '@/components/sidebar-plan-card';
import { useWorkspacePlanOptional } from '@/components/workspace-plan-provider';
import { isPaidEverittosPlan, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canManageBilling, canManageOrganizationSettings } from '@/lib/roles';
import { isClientRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type MobileNavProps = {
  plan?: EverittosPlan | string | null;
  role?: UserRole | string | null;
};

export function MobileNav({ plan, role: roleProp }: MobileNavProps) {
  const pathname = usePathname() || '/';
  const hideUpgradeCta = pathname.startsWith('/settings/billing');
  const router = useRouter();
  const { t } = useTranslation();
  const workspacePlan = useWorkspacePlanOptional();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const normalized =
    workspacePlan?.plan ?? (plan != null ? normalizePlan(plan) : null);
  const resolvedRole = workspacePlan?.role ?? normalizeRole(roleProp);
  const [role, setRole] = useState<UserRole>(resolvedRole);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setRole(resolvedRole);
  }, [resolvedRole]);

  useEffect(() => {
    if (roleProp) setRole(normalizeRole(roleProp));
  }, [roleProp]);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      if (!roleProp && !workspacePlan?.role) {
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
  }, [roleProp, workspacePlan?.role]);

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

  const showBillingLink = normalized != null && canManageBilling(role);
  const showIntegrationsLink = canManageOrganizationSettings(role);
  const showUpgrade =
    normalized != null && !hideUpgradeCta && !isPaidEverittosPlan(normalized) && canManageBilling(role);

  const drawer = open ? (
    <div className="mobile-nav-overlay mobile-nav-overlay-portal" role="presentation" onClick={() => setOpen(false)}>
      <nav
        id="mobile-nav-panel"
        className="mobile-nav-drawer"
        aria-label={t('ux.mobileNavLabel')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mobile-nav-drawer-head">
          <BrandLogo href="/dashboard" size={28} showName className="mobile-nav-brand-logo" />
          <button type="button" className="btn btn-sm mobile-nav-close-btn" onClick={() => setOpen(false)}>
            {t('common.close')}
          </button>
        </div>

        <div className="mobile-nav-panel">
          {normalized ? (
            <AppNavItems
              plan={normalized}
              role={role}
              unread={unread}
              linkClassName="mobile-nav-drawer-link"
              onNavigate={() => setOpen(false)}
            />
          ) : null}
        </div>

        <div className="mobile-nav-drawer-footer">
          <div className="app-nav" aria-label="Account navigation">
            {showIntegrationsLink ? (
              <Link className="nav-item mobile-nav-drawer-link" href="/settings/integrations" onClick={() => setOpen(false)}>
                <span className="nav-item-label">Google Calendar</span>
              </Link>
            ) : null}
            <Link className="nav-item mobile-nav-drawer-link" href="/settings/account" onClick={() => setOpen(false)}>
              <span className="nav-item-label">Account settings</span>
            </Link>
            {showBillingLink ? (
              <Link className="nav-item mobile-nav-drawer-link" href="/settings/billing" onClick={() => setOpen(false)}>
                <span className="nav-item-label">Plans and pricing</span>
              </Link>
            ) : null}
          </div>

          <SidebarPlanCard
            plan={normalized}
            showBillingLink={showBillingLink}
            showUpgrade={showUpgrade}
            showViewPlans={showBillingLink && !showUpgrade && !hideUpgradeCta}
            onNavigate={() => setOpen(false)}
          />
          <LanguageSwitcher id="mobile-drawer-language" variant="drawer" />
          {!isClientRole(role) ? (
            <button className="btn btn-block mobile-nav-logout" type="button" onClick={() => void logout()}>
              {t('ux.logOut')}
            </button>
          ) : null}
        </div>
      </nav>
    </div>
  ) : null;

  return (
    <header className={`mobile-nav${open ? ' mobile-nav-open' : ''}`} aria-label={t('ux.mobileNavLabel')}>
      <div className="mobile-nav-bar">
        <BrandLogo href="/dashboard" size={26} showName className="mobile-nav-brand-logo" />
        <div className="mobile-nav-bar-actions">
          <LanguageSwitcher id="mobile-header-language" variant="compact" className="mobile-nav-language" />
          <button
            type="button"
            className="mobile-nav-menu-btn"
            aria-label={open ? t('common.close') : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-nav-panel"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="mobile-nav-menu-icon" aria-hidden="true" />
            <span className="sr-only">{open ? t('common.close') : 'Open menu'}</span>
          </button>
        </div>
      </div>

      {mounted && drawer ? createPortal(drawer, document.body) : null}
    </header>
  );
}
