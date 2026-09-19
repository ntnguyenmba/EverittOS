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
import { supabase } from '@/lib/supabase';

type MobileNavProps = { plan?: EverittosPlan | string | null; role?: UserRole | string | null };

const MENU_LABELS = {
  en: 'Menu',
  es: 'Menú',
  vi: 'Menu'
} as const;

export function MobileNav({ plan, role: roleProp }: MobileNavProps) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { t, locale } = useTranslation();
  const workspacePlan = useWorkspacePlanOptional();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const normalized = normalizePlan(workspacePlan?.plan ?? plan);
  const resolvedRole = roleProp != null ? normalizeRole(roleProp) : normalizeRole(workspacePlan?.role);
  const [role, setRole] = useState<UserRole>(resolvedRole);
  const [unread, setUnread] = useState(0);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => setRole(resolvedRole), [resolvedRole]);
  useEffect(() => { if (roleProp) setRole(normalizeRole(roleProp)); }, [roleProp]);
  useEffect(() => { setOpen(false); document.body.classList.remove('mobile-nav-open'); }, [pathname]);
  useEffect(() => {
    if (!open) { document.body.classList.remove('mobile-nav-open'); return; }
    document.body.classList.add('mobile-nav-open');
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('mobile-nav-open'); document.removeEventListener('keydown', onKey); };
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
  function openAskEveritt() {
    document.querySelector<HTMLButtonElement>('.app-page-content .everitt-cmd-trigger')?.click();
  }

  const isFocusedPortal = isClientRole(role) || isContractorRole(role);
  const homeHref = dashboardPathForRole(role);
  const drawer = open ? (
    <div className="mobile-nav-overlay mobile-nav-overlay-portal" role="presentation" onClick={() => setOpen(false)}>
      <nav id="mobile-nav-panel" className="mobile-nav-drawer" aria-label={MENU_LABELS[locale]} onClick={(e) => e.stopPropagation()}>
        <div className="mobile-nav-drawer-head">
          <p className="mobile-nav-drawer-title">{MENU_LABELS[locale]}</p>
          <button type="button" className="mobile-nav-close-btn" aria-label={t('common.close')} onClick={() => setOpen(false)}><span aria-hidden="true">×</span></button>
        </div>
        <div className="mobile-nav-panel"><AppNavItems plan={normalized} role={role} unread={unread} linkClassName="mobile-nav-drawer-link" onNavigate={() => setOpen(false)} /></div>
        <div className="mobile-nav-drawer-footer">
          <div className="mobile-nav-switch-stack">
            <OrgSwitcher />
            <LanguageSwitcher id="mobile-drawer-language" variant="drawer" />
          </div>
          <button className="mobile-nav-logout" type="button" onClick={() => void logout()}>{t('ux.logOut')}</button>
        </div>
      </nav>
    </div>
  ) : null;

  return (
    <header className={`mobile-nav${isFocusedPortal ? ' mobile-nav-focused-portal' : ''}${open ? ' mobile-nav-open' : ''}`} aria-label={MENU_LABELS[locale]}>
      <div className="mobile-nav-bar">
        <BrandLogo href={homeHref} size={30} showName className="mobile-nav-top-logo" />
        <div className="mobile-nav-actions">
          {!isFocusedPortal ? <button type="button" className="mobile-nav-search-btn" aria-label="Ask Everitt" onClick={openAskEveritt}><span className="mobile-nav-search-icon" aria-hidden="true" /></button> : null}
          <button type="button" className="mobile-nav-menu-btn" aria-label={open ? t('common.close') : MENU_LABELS[locale]} aria-expanded={open} aria-controls="mobile-nav-panel" onClick={() => setOpen((value) => !value)}><span className="mobile-nav-menu-icon" aria-hidden="true" /></button>
        </div>
      </div>
      {mounted ? createPortal(drawer, document.body) : null}
      <style jsx global>{`
        .mobile-nav{width:100%;border:0;background:var(--eo-color-brand)!important}.mobile-nav-bar{min-height:56px;width:100%;padding:6px 4px;display:flex;align-items:center;justify-content:space-between;gap:12px;box-sizing:border-box;border:0;border-radius:0;background:var(--eo-color-brand)!important;box-shadow:none}.mobile-nav-actions{display:flex;align-items:center;gap:8px}.mobile-nav-top-logo{min-width:0;display:inline-flex;align-items:center;gap:10px;color:var(--eo-color-on-brand)!important;font-weight:700;text-decoration:none}.mobile-nav-top-logo .brand-logo-image{display:block;border-radius:9px}.mobile-nav-top-logo .brand-logo-name{color:var(--eo-color-on-brand)!important;font-family:var(--font-ui),Manrope,system-ui,sans-serif!important;font-size:18px!important;line-height:1!important;white-space:nowrap}.mobile-nav-search-btn,.mobile-nav-menu-btn{position:relative;z-index:2147482999;width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.28);border-radius:50%;background:var(--eo-color-brand-deep)!important;color:var(--eo-color-on-brand);box-shadow:none;cursor:pointer;pointer-events:auto!important;touch-action:manipulation}.mobile-nav-search-icon{position:relative;width:16px;height:16px;border:2px solid var(--eo-color-on-brand);border-radius:50%;box-sizing:border-box}.mobile-nav-search-icon:after{content:'';position:absolute;width:7px;height:2px;right:-5px;bottom:-2px;border-radius:999px;background:var(--eo-color-on-brand);transform:rotate(45deg)}.mobile-nav-menu-icon,.mobile-nav-menu-icon:before,.mobile-nav-menu-icon:after{display:block;width:18px;height:2px;border-radius:999px;background:var(--eo-color-on-brand)}.mobile-nav-menu-icon{position:relative}.mobile-nav-menu-icon:before,.mobile-nav-menu-icon:after{content:'';position:absolute;left:0}.mobile-nav-menu-icon:before{top:-6px}.mobile-nav-menu-icon:after{top:6px}
        .mobile-nav-overlay-portal{position:fixed;inset:0;z-index:2147483000;padding:0;display:flex;align-items:stretch;justify-content:flex-end;background:rgba(13,24,33,.46);pointer-events:auto!important}.mobile-nav-drawer{position:relative;z-index:2147483001;width:min(300px,76vw);height:100dvh;max-height:100dvh;display:grid;grid-template-rows:auto minmax(0,1fr) auto;border:0;border-radius:0;background:var(--eo-color-brand)!important;color:#f4f7f9!important;box-shadow:-18px 0 40px rgba(9,24,35,.28);overflow:hidden;pointer-events:auto!important;font-family:var(--font-ui),Manrope,system-ui,sans-serif!important}.mobile-nav-drawer-head{min-height:58px;padding:max(12px,env(safe-area-inset-top)) 16px 10px 18px;display:flex;align-items:center;justify-content:space-between;gap:14px;border-bottom:1px solid rgba(255,255,255,.16);background:var(--eo-color-brand)!important}.mobile-nav-drawer-title{margin:0;color:var(--eo-color-on-brand)!important;font-size:19px!important;font-weight:500!important;letter-spacing:-.02em;line-height:1}.mobile-nav-close-btn{width:40px;height:40px;border:1px solid rgba(255,255,255,.22);border-radius:10px;display:flex;align-items:center;justify-content:center;background:transparent!important;color:var(--eo-color-on-brand)!important;font-size:24px;font-weight:400;line-height:1;cursor:pointer}.mobile-nav-panel{overflow-y:auto;padding:4px 0 8px;background:var(--eo-color-brand)!important}.mobile-nav-panel .app-nav,.mobile-nav-panel .nav-section{display:flex!important;flex-direction:column!important;gap:0!important}.mobile-nav-panel .nav-section-label{margin:14px 18px 3px!important;padding:0!important;color:rgba(255,255,255,.62)!important;font-size:10px!important;letter-spacing:.08em!important}.mobile-nav-drawer-link,.mobile-nav-drawer-link.nav-item{min-height:50px!important;margin:0!important;padding:12px 18px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;border:0!important;border-bottom:1px solid rgba(255,255,255,.14)!important;border-radius:0!important;background:transparent!important;color:#f4f7f9!important;font-family:var(--font-ui),Manrope,system-ui,sans-serif!important;font-size:15.5px!important;font-weight:500!important;line-height:1.25!important;text-decoration:none!important;box-shadow:none!important;opacity:1!important;visibility:visible!important}.mobile-nav-drawer-link .nav-item-label{display:block!important;color:#f4f7f9!important;opacity:1!important;visibility:visible!important}.mobile-nav-drawer-link .nav-item-meta,.mobile-nav-drawer-link .nav-lock-icon{color:rgba(244,247,249,.7)!important;opacity:1!important}.mobile-nav-drawer-link .nav-plan-chip{color:#d7e3ea!important;background:rgba(255,255,255,.08)!important;border:1px solid rgba(255,255,255,.14)!important}.mobile-nav-drawer-link:focus-visible{outline:2px solid rgba(234,242,255,.72)!important;outline-offset:-3px!important;background:transparent!important;color:var(--eo-color-on-brand)!important}.mobile-nav-drawer-link:not(.active):not([aria-current='page']),.mobile-nav-drawer-link:not(.active):not([aria-current='page']):hover{background:transparent!important;color:#f4f7f9!important;box-shadow:none!important}.mobile-nav-drawer-link.active,.mobile-nav-drawer-link[aria-current='page']{padding-left:18px!important;border-color:rgba(255,255,255,.14)!important;border-radius:0!important;background:#eaf2ff!important;color:#172033!important;box-shadow:inset 3px 0 0 #4f7cc4!important}.mobile-nav-drawer-link.active .nav-item-label,.mobile-nav-drawer-link[aria-current='page'] .nav-item-label{color:#172033!important}.mobile-nav-drawer-link.active .nav-item-meta,.mobile-nav-drawer-link[aria-current='page'] .nav-item-meta,.mobile-nav-drawer-link.active .nav-lock-icon,.mobile-nav-drawer-link[aria-current='page'] .nav-lock-icon{color:#5b667a!important}
        .mobile-nav-drawer-footer{display:flex;flex-direction:column;gap:12px;padding:14px 16px max(16px,env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.14);background:var(--eo-color-brand-deep)!important;color:#f4f7f9!important}.mobile-nav-switch-stack{display:flex;flex-direction:column;gap:10px;width:100%;min-width:0}.mobile-nav-drawer-footer .org-switcher,.mobile-nav-drawer-footer .language-switcher{display:grid!important;gap:6px!important;width:100%!important;min-width:0;margin:0!important}.mobile-nav-drawer-footer .org-switcher-label,.mobile-nav-drawer-footer .language-switcher-label{display:block!important;color:#f4f7f9!important;font-size:12px!important;font-weight:600!important;line-height:1.2!important}.mobile-nav-drawer-footer label,.mobile-nav-drawer-footer span{color:#f4f7f9!important}.mobile-nav-drawer-footer select,.mobile-nav-drawer-footer .input{width:100%!important;min-width:0!important;max-width:100%!important;min-height:42px;border:1px solid rgba(255,255,255,.2)!important;border-radius:10px!important;background:var(--eo-color-brand)!important;color:var(--eo-color-on-brand)!important;font-size:13.5px!important;box-sizing:border-box!important}.mobile-nav-drawer-footer select option{color:var(--eo-color-text);background:var(--eo-color-surface)}.mobile-nav-logout{width:100%;min-height:46px;padding:0 16px;border:1px solid rgba(255,255,255,.2);border-radius:11px;background:var(--eo-color-accent)!important;color:var(--eo-color-on-brand)!important;font:inherit;font-size:15px!important;font-weight:700;cursor:pointer}body.mobile-nav-open{overflow:hidden}
        @media(hover:hover) and (pointer:fine){.mobile-nav-drawer-link:not(.active):not([aria-current='page']):hover{background:rgba(255,255,255,.06)!important;color:var(--eo-color-on-brand)!important}}@media(max-width:760px){.mobile-nav-bar{min-height:52px}.mobile-nav-top-logo .brand-logo-name{font-size:17px!important}.mobile-nav-search-btn,.mobile-nav-menu-btn{width:42px;height:42px}}
        @media(min-width:700px){.mobile-nav-drawer{width:min(300px,74vw)}}
        @media(max-width:380px){.mobile-nav-drawer{width:80vw}.mobile-nav-top-logo .brand-logo-name{font-size:15px!important}.mobile-nav-drawer-link{font-size:15px!important;padding:12px 16px!important}.mobile-nav-drawer-footer{padding-left:14px;padding-right:14px}}
      `}</style>
    </header>
  );
}
