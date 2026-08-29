'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppNavItems } from '@/components/app-nav-items';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useTranslation } from '@/components/locale-provider';
import { useWorkspacePlanOptional } from '@/components/workspace-plan-provider';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { dashboardPathForRole } from '@/lib/dashboard-nav';
import { isClientRole, isContractorRole, normalizeRole, type UserRole } from '@/lib/roles';
import { isNativePlatform } from '@/lib/platform/detect';
import { supabase } from '@/lib/supabase';

type MobileNavProps = { plan?: EverittosPlan | string | null; role?: UserRole | string | null };
const OPEN_MENU_EVENT = 'everittos:open-mobile-menu';
const PRIMARY_BOTTOM_HREFS = ['/', '/dashboard', '/jobs', '/customers', '/calendar', '/settings'];

export function MobileNav({ plan, role: roleProp }: MobileNavProps) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { t } = useTranslation();
  const workspacePlan = useWorkspacePlanOptional();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [native, setNative] = useState(false);
  const normalized = workspacePlan?.plan ?? (plan != null ? normalizePlan(plan) : null);
  const resolvedRole = workspacePlan?.role ?? normalizeRole(roleProp);
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

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) { document.body.classList.remove('mobile-nav-open'); return; }
    document.body.classList.add('mobile-nav-open');
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('mobile-nav-open'); document.removeEventListener('keydown', onKey); };
  }, [open]);

  async function logout() {
    setOpen(false);
    const { performClientLogout } = await import('@/lib/client-logout');
    await performClientLogout(router);
  }

  const isFocusedPortal = isClientRole(role) || isContractorRole(role);
  const homeHref = dashboardPathForRole(role);
  const drawer = open ? <div className="mobile-nav-overlay mobile-nav-overlay-portal" role="presentation" onClick={() => setOpen(false)}>
    <nav id="mobile-nav-panel" className="mobile-nav-drawer" aria-label={t('ux.mobileNavLabel')} onClick={(e) => e.stopPropagation()}>
      <div className="mobile-nav-drawer-handle" aria-hidden="true" />
      <div className="mobile-nav-drawer-head"><BrandLogo href={homeHref} size={28} showName className="mobile-nav-brand-logo" /><button type="button" className="mobile-nav-close-btn" aria-label={t('common.close')} onClick={() => setOpen(false)}>×</button></div>
      <div className="mobile-nav-panel">{normalized ? <AppNavItems plan={normalized} role={role} unread={unread} linkClassName="mobile-nav-drawer-link" excludeHrefs={PRIMARY_BOTTOM_HREFS} onNavigate={() => setOpen(false)} /> : null}</div>
      <div className="mobile-nav-drawer-footer"><LanguageSwitcher id="mobile-drawer-language" variant="drawer" /><button className="mobile-nav-logout" type="button" onClick={() => void logout()}>{t('ux.logOut')}</button></div>
    </nav>
  </div> : null;

  return <header className={`mobile-nav${isFocusedPortal ? ' mobile-nav-focused-portal' : ''}${open ? ' mobile-nav-open' : ''}`} aria-label={t('ux.mobileNavLabel')}>
    {!native ? <div className="mobile-nav-bar"><div className="mobile-nav-bar-actions"><LanguageSwitcher id="mobile-header-language" variant="compact" className="mobile-nav-language" /><button type="button" className="mobile-nav-menu-btn" aria-label={open ? t('common.close') : t('ux.mobileNavLabel')} aria-expanded={open} aria-controls="mobile-nav-panel" onClick={() => setOpen((value) => !value)}><span className="mobile-nav-menu-icon" aria-hidden="true" /></button></div></div> : null}
    {mounted ? createPortal(drawer, document.body) : null}
    <style>{`
      .mobile-nav{border-bottom:0;background:transparent}.mobile-nav-bar{min-height:52px;padding:6px 0;display:flex;align-items:center;justify-content:flex-end;gap:14px;box-sizing:border-box;background:transparent!important;border:0!important;box-shadow:none!important}.mobile-nav-brand-logo{color:#173044}.mobile-nav-bar-actions{display:flex;align-items:center;gap:10px}.mobile-nav-language select,.mobile-nav-language button{min-height:44px;border:1px solid #c8d1d7;border-radius:14px;background:#fff;color:#243e51;font-weight:700}.mobile-nav-menu-btn{width:46px;height:46px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:14px;background:#fff;color:#243f53;box-shadow:0 8px 24px rgba(9,24,35,.08);cursor:pointer}
      .mobile-nav-overlay-portal{position:fixed;inset:0;z-index:1000;display:flex;align-items:flex-end;justify-content:center;padding:0;background:rgba(17,31,40,.34);backdrop-filter:blur(3px)}.mobile-nav-drawer{width:100%;max-height:min(78dvh,720px);display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;border:1px solid #d5dde2;border-bottom:0;border-radius:26px 26px 0 0;background:#fff;box-shadow:0 -14px 50px rgba(16,34,47,.18);overflow:hidden}.mobile-nav-drawer-handle{width:42px;height:5px;margin:10px auto 2px;border-radius:999px;background:#c5cdd2}.mobile-nav-drawer-head{min-height:58px;padding:8px 20px 10px;display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid #edf0f2;background:#fff}.mobile-nav-close-btn{width:40px;height:40px;border:0;border-radius:50%;background:#f1f4f6;color:#243f53;font-size:28px;line-height:1;cursor:pointer}.mobile-nav-panel{overflow-y:auto;padding:10px 14px 12px;background:#fff}.mobile-nav-panel .app-nav{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.mobile-nav-drawer-link{min-height:54px!important;margin:0!important;padding:12px 14px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;border:1px solid #e1e6e9!important;border-radius:15px!important;background:#f8fafb!important;color:#243f53!important;font-size:15px!important;font-weight:700!important;box-shadow:none!important}.mobile-nav-drawer-link.active,.mobile-nav-drawer-link[aria-current='page']{border-color:#9fb2bf!important;background:#eef3f6!important;color:#18394e!important}.mobile-nav-drawer-footer{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:10px;padding:12px 14px max(14px,env(safe-area-inset-bottom));border-top:1px solid #edf0f2;background:#f7f9fa}.mobile-nav-drawer-footer label{font-size:12px}.mobile-nav-drawer-footer select{min-height:46px;border:1px solid #c9d2d8;border-radius:14px;background:#fff;color:#243f53}.mobile-nav-logout{min-height:46px;padding:0 18px;border:1px solid #c9d2d8;border-radius:14px;background:#fff;color:#243f53;font:inherit;font-weight:700;cursor:pointer}body.mobile-nav-open{overflow:hidden}
      @media(min-width:700px){.mobile-nav-overlay-portal{align-items:stretch;justify-content:flex-end}.mobile-nav-drawer{width:min(390px,calc(100vw - 28px));height:100dvh;max-height:none;border-radius:0;border-top:0}.mobile-nav-drawer-handle{display:none}.mobile-nav-panel .app-nav{grid-template-columns:1fr}}
      @media(max-width:480px){.mobile-nav-language{display:none}.mobile-nav-panel .app-nav{grid-template-columns:1fr 1fr}}
    `}</style>
  </header>;
}
