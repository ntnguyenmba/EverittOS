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
      <div className="mobile-nav-drawer-head"><BrandLogo href={homeHref} size={30} showName className="mobile-nav-brand-logo" /><button type="button" className="btn btn-sm mobile-nav-close-btn" onClick={() => setOpen(false)}>{t('common.close')}</button></div>
      <div className="mobile-nav-panel">{normalized ? <AppNavItems plan={normalized} role={role} unread={unread} linkClassName="mobile-nav-drawer-link" onNavigate={() => setOpen(false)} /> : null}</div>
      <div className="mobile-nav-drawer-footer"><LanguageSwitcher id="mobile-drawer-language" variant="drawer" /><button className="btn btn-block mobile-nav-logout" type="button" onClick={() => void logout()}>{t('ux.logOut')}</button></div>
    </nav>
  </div> : null;

  return <header className={`mobile-nav${isFocusedPortal ? ' mobile-nav-focused-portal' : ''}${open ? ' mobile-nav-open' : ''}`} aria-label={t('ux.mobileNavLabel')}>
    {!native ? <div className="mobile-nav-bar"><BrandLogo href={homeHref} size={28} showName className="mobile-nav-brand-logo" /><div className="mobile-nav-bar-actions"><LanguageSwitcher id="mobile-header-language" variant="compact" className="mobile-nav-language" /><button type="button" className="mobile-nav-menu-btn" aria-label={open ? t('common.close') : t('ux.mobileNavLabel')} aria-expanded={open} aria-controls="mobile-nav-panel" onClick={() => setOpen((value) => !value)}><span className="mobile-nav-menu-icon" aria-hidden="true" /></button></div></div> : null}
    {mounted ? createPortal(drawer, document.body) : null}
    <style>{`
      .mobile-nav{border-bottom:1px solid #b9c7d0;background:rgba(247,250,251,.96);box-shadow:0 8px 24px rgba(24,44,59,.08);backdrop-filter:blur(18px)}
      html[data-native-app='true'] .mobile-nav{display:none}
      .mobile-nav-bar{min-height:68px;padding:10px 28px;display:flex;align-items:center;justify-content:space-between;gap:14px;box-sizing:border-box}.mobile-nav-brand-logo{color:#173044}.mobile-nav-bar-actions{display:flex;align-items:center;gap:10px}.mobile-nav-language select,.mobile-nav-language button{min-height:44px;border:1px solid #afbdc8;border-radius:10px;background:#fff;color:#243e51;font-weight:700}.mobile-nav-menu-btn{width:46px;height:46px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #9eafbb;border-radius:12px;background:#243f53;color:#fff;cursor:pointer}.mobile-nav-overlay-portal{position:fixed;inset:0;z-index:1000;display:flex;justify-content:flex-end;background:rgba(15,31,42,.48);backdrop-filter:blur(5px)}.mobile-nav-drawer{width:min(390px,calc(100vw - 28px));height:100dvh;display:grid;grid-template-rows:auto minmax(0,1fr) auto;border-left:1px solid rgba(255,255,255,.65);background:#f6f9fa;box-shadow:-24px 0 70px rgba(10,28,40,.24)}.mobile-nav-drawer-head{min-height:76px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid #c7d2da;background:#fff}.mobile-nav-close-btn{min-height:42px;padding-inline:15px}.mobile-nav-panel{overflow-y:auto;padding:16px 14px 24px}.mobile-nav-drawer-link{min-height:50px;margin:4px 0;padding:12px 14px;border:1px solid transparent;border-radius:12px;color:#30485a;font-size:15px;font-weight:700}.mobile-nav-drawer-link:hover,.mobile-nav-drawer-link[aria-current='page']{border-color:#bccad3;background:#fff;color:#1e3c50}.mobile-nav-drawer-footer{display:grid;gap:12px;padding:16px 18px max(18px,env(safe-area-inset-bottom));border-top:1px solid #c7d2da;background:#e8eef2}.mobile-nav-logout{min-height:48px;background:#fff;color:#243f53}body.mobile-nav-open{overflow:hidden}@media(max-width:480px){.mobile-nav-language{display:none}.mobile-nav-bar{min-height:64px;padding:9px 20px}.mobile-nav-drawer{width:calc(100vw - 18px)}}
    `}</style>
  </header>;
}
