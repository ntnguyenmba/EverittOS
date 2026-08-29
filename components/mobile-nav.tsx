'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppNavItems } from '@/components/app-nav-items';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { OrgSwitcher } from '@/components/org-switcher';
import { useTranslation } from '@/components/locale-provider';
import { useWorkspacePlanOptional } from '@/components/workspace-plan-provider';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { dashboardPathForRole } from '@/lib/dashboard-nav';
import { isClientRole, isContractorRole, normalizeRole, type UserRole } from '@/lib/roles';
import { isNativePlatform } from '@/lib/platform/detect';
import { supabase } from '@/lib/supabase';

type MobileNavProps = { plan?: EverittosPlan | string | null; role?: UserRole | string | null };
const OPEN_MENU_EVENT = 'everittos:open-mobile-menu';
const DESKTOP_NAV_QUERY = '(min-width: 1280px)';

export function MobileNav({ plan, role: roleProp }: MobileNavProps) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { t } = useTranslation();
  const workspacePlan = useWorkspacePlanOptional();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [native, setNative] = useState(false);
  const normalized = normalizePlan(workspacePlan?.plan ?? plan);
  const resolvedRole = roleProp != null ? normalizeRole(roleProp) : normalizeRole(workspacePlan?.role);
  const [role, setRole] = useState<UserRole>(resolvedRole);
  const [unread, setUnread] = useState(0);

  useEffect(() => { setMounted(true); setNative(isNativePlatform()); }, []);
  useEffect(() => setRole(resolvedRole), [resolvedRole]);
  useEffect(() => { if (roleProp) setRole(normalizeRole(roleProp)); }, [roleProp]);

  useEffect(() => {
    const openMenu = () => setOpen(true);
    window.addEventListener(OPEN_MENU_EVENT, openMenu);
    return () => window.removeEventListener(OPEN_MENU_EVENT, openMenu);
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_NAV_QUERY);
    const closeOnDesktop = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) {
        setOpen(false);
        document.body.classList.remove('mobile-nav-open');
      }
    };
    closeOnDesktop(desktop);
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  useEffect(() => {
    setOpen(false);
    document.body.classList.remove('mobile-nav-open');
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      document.body.classList.remove('mobile-nav-open');
      return;
    }
    document.body.classList.add('mobile-nav-open');
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('mobile-nav-open');
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (!roleProp && !workspacePlan?.role) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
        setRole(normalizeRole(profile?.role));
      }
      const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null);
      setUnread(count || 0);
    }
    void load();
  }, [roleProp, workspacePlan?.role]);

  async function logout() {
    setOpen(false);
    const { performClientLogout } = await import('@/lib/client-logout');
    await performClientLogout(router);
  }

  const isFocusedPortal = isClientRole(role) || isContractorRole(role);
  const homeHref = dashboardPathForRole(role);
  const drawer = open ? (
    <div className="mobile-nav-overlay mobile-nav-overlay-portal" role="presentation" onClick={() => setOpen(false)}>
      <nav id="mobile-nav-panel" className="mobile-nav-drawer" aria-label={t('ux.mobileNavLabel')} onClick={(e) => e.stopPropagation()}>
        <div className="mobile-nav-drawer-handle" aria-hidden="true" />
        <div className="mobile-nav-drawer-head">
          <BrandLogo href={homeHref} size={28} showName className="mobile-nav-brand-logo" />
          <button type="button" className="mobile-nav-close-btn" aria-label={t('common.close')} onClick={() => setOpen(false)}>×</button>
        </div>
        <div className="mobile-nav-panel">
          <AppNavItems plan={normalized} role={role} unread={unread} linkClassName="mobile-nav-drawer-link" onNavigate={() => setOpen(false)} />
        </div>
        <div className="mobile-nav-drawer-footer">
          <OrgSwitcher />
          <LanguageSwitcher id="mobile-drawer-language" variant="drawer" />
          <button className="mobile-nav-logout" type="button" onClick={() => void logout()}>{t('ux.logOut')}</button>
        </div>
      </nav>
    </div>
  ) : null;

  return (
    <header className={`mobile-nav${isFocusedPortal ? ' mobile-nav-focused-portal' : ''}${open ? ' mobile-nav-open' : ''}`} aria-label={t('ux.mobileNavLabel')}>
      {!native ? (
        <div className="mobile-nav-bar">
          <BrandLogo href={homeHref} size={32} showName={false} className="mobile-nav-top-logo" />
          <div className="mobile-nav-bar-actions">
            <LanguageSwitcher id="mobile-header-language" variant="compact" className="mobile-nav-language" />
            <button type="button" className="mobile-nav-menu-btn" aria-label={open ? t('common.close') : t('ux.mobileNavLabel')} aria-expanded={open} aria-controls="mobile-nav-panel" onClick={() => setOpen((value) => !value)}>
              <span className="mobile-nav-menu-icon" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
      {mounted ? createPortal(drawer, document.body) : null}
      <style>{`
        .mobile-nav{border-bottom:0;background:transparent}.mobile-nav-bar{min-height:52px;padding:6px 0;display:flex;align-items:center;justify-content:space-between;gap:14px;box-sizing:border-box;background:transparent!important;border:0!important;box-shadow:none!important}.mobile-nav-top-logo{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:12px;background:#fff;box-shadow:0 8px 24px rgba(9,24,35,.14)}.mobile-nav-top-logo .brand-logo-image{display:block;border-radius:8px}.mobile-nav-brand-logo{color:#173044}.mobile-nav-bar-actions{display:flex;align-items:center;gap:10px;margin-left:auto}.mobile-nav-language select,.mobile-nav-language button{min-height:44px;border:1px solid #c8d1d7;border-radius:14px;background:#fff;color:#243e51;font-weight:700}.mobile-nav-menu-btn{width:46px;height:46px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #d2dbe0;border-radius:14px;background:#fff;color:#173044;box-shadow:0 8px 24px rgba(9,24,35,.08);cursor:pointer;pointer-events:auto!important;touch-action:manipulation}
        .mobile-nav-overlay-portal{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;padding:0;background:rgba(17,31,40,.46);backdrop-filter:blur(3px);pointer-events:auto!important}.mobile-nav-drawer{position:relative;z-index:2147483001;width:100%;max-height:min(82dvh,760px);display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;border:1px solid #d5dde2;border-bottom:0;border-radius:26px 26px 0 0;background:#fff;color:#173044;box-shadow:0 -14px 50px rgba(16,34,47,.2);overflow:hidden;pointer-events:auto!important}.mobile-nav-drawer-handle{width:42px;height:5px;margin:10px auto 2px;border-radius:999px;background:#c5cdd2}.mobile-nav-drawer-head{min-height:58px;padding:8px 20px 10px;display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid #edf0f2;background:#fff}.mobile-nav-close-btn{width:40px;height:40px;border:0;border-radius:50%;background:#eef2f4;color:#173044;font-size:28px;line-height:1;cursor:pointer}.mobile-nav-panel{overflow-y:auto;padding:12px 14px;background:#fff}.mobile-nav-panel .app-nav{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.mobile-nav-drawer-link{min-height:58px!important;margin:0!important;padding:13px 14px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;border:1px solid #dbe3e7!important;border-radius:15px!important;background:#f7f9fa!important;color:#173044!important;font-size:16px!important;font-weight:700!important;line-height:1.25!important;text-decoration:none!important;box-shadow:none!important}.mobile-nav-drawer-link .nav-item-label{color:#173044!important}.mobile-nav-drawer-link.active,.mobile-nav-drawer-link[aria-current='page']{border-color:#9fb2bf!important;background:#eaf0f3!important;color:#173044!important}.mobile-nav-drawer-footer{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;align-items:end;gap:10px;padding:12px 14px max(14px,env(safe-area-inset-bottom));border-top:1px solid #e3e8eb;background:#f4f7f8;color:#173044}.mobile-nav-drawer-footer label,.mobile-nav-drawer-footer span{color:#173044!important}.mobile-nav-drawer-footer select{min-height:46px;border:1px solid #c9d2d8;border-radius:14px;background:#fff;color:#173044}.mobile-nav-logout{min-height:46px;padding:0 18px;border:1px solid #c9d2d8;border-radius:14px;background:#fff;color:#173044;font:inherit;font-weight:700;cursor:pointer}body.mobile-nav-open{overflow:hidden}
        @media(min-width:1280px){.mobile-nav-overlay-portal{display:none!important;visibility:hidden!important;pointer-events:none!important}}
        @media(min-width:700px) and (max-width:1279px){.mobile-nav-overlay-portal{align-items:stretch;justify-content:flex-end}.mobile-nav-drawer{width:min(390px,calc(100vw - 28px));height:100dvh;max-height:none;border-radius:0;border-top:0}.mobile-nav-drawer-handle{display:none}.mobile-nav-panel .app-nav{grid-template-columns:1fr}.mobile-nav-drawer-footer{grid-template-columns:1fr}}
        @media(max-width:480px){.mobile-nav-language{display:none}.mobile-nav-panel .app-nav{grid-template-columns:1fr 1fr}.mobile-nav-drawer-footer{grid-template-columns:1fr 1fr}.mobile-nav-logout{grid-column:1/-1}}
      `}</style>
    </header>
  );
}
