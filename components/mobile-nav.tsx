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

export function MobileNav({ plan, role: roleProp }: MobileNavProps) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { t } = useTranslation();
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
      <nav id="mobile-nav-panel" className="mobile-nav-drawer" aria-label={t('ux.mobileNavLabel')} onClick={(e) => e.stopPropagation()}>
        <div className="mobile-nav-drawer-head">
          <BrandLogo href={homeHref} size={30} showName className="mobile-nav-brand-logo" />
          <button type="button" className="mobile-nav-close-btn" aria-label={t('common.close')} onClick={() => setOpen(false)}><span aria-hidden="true">−</span></button>
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
      <div className="mobile-nav-bar">
        <BrandLogo href={homeHref} size={30} showName className="mobile-nav-top-logo" />
        <div className="mobile-nav-actions">
          {!isFocusedPortal ? <button type="button" className="mobile-nav-search-btn" aria-label="Ask Everitt" onClick={openAskEveritt}><span className="mobile-nav-search-icon" aria-hidden="true" /></button> : null}
          <button type="button" className="mobile-nav-menu-btn" aria-label={open ? t('common.close') : t('ux.mobileNavLabel')} aria-expanded={open} aria-controls="mobile-nav-panel" onClick={() => setOpen((value) => !value)}><span className="mobile-nav-menu-icon" aria-hidden="true" /></button>
        </div>
      </div>
      {mounted ? createPortal(drawer, document.body) : null}
      <style jsx global>{`
        .mobile-nav{width:100%;border:0;background:transparent}.mobile-nav-bar{min-height:64px;width:100%;padding:8px 10px 8px 14px;display:flex;align-items:center;justify-content:space-between;gap:14px;box-sizing:border-box;border:1px solid #DDE6F2;border-radius:24px;background:#FFFFFF;box-shadow:0 8px 26px rgba(23,32,51,.11)}.mobile-nav-actions{display:flex;align-items:center;gap:7px}.mobile-nav-top-logo{min-width:0;display:inline-flex;align-items:center;gap:10px;color:#172033!important;font-weight:750;text-decoration:none}.mobile-nav-top-logo .brand-logo-image{display:block;border-radius:10px}.mobile-nav-top-logo .brand-logo-name{color:#172033!important;font-size:18px!important;line-height:1!important;white-space:nowrap}.mobile-nav-search-btn,.mobile-nav-menu-btn{position:relative;z-index:2147482999;width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #DDE6F2;border-radius:50%;background:#F8FAFC;color:#172033;box-shadow:none;cursor:pointer;pointer-events:auto!important;touch-action:manipulation}.mobile-nav-search-icon{position:relative;width:16px;height:16px;border:2px solid #234A84;border-radius:50%;box-sizing:border-box}.mobile-nav-search-icon:after{content:'';position:absolute;width:7px;height:2px;right:-5px;bottom:-2px;border-radius:999px;background:#234A84;transform:rotate(45deg)}.mobile-nav-menu-icon,.mobile-nav-menu-icon:before,.mobile-nav-menu-icon:after{display:block;width:18px;height:2px;border-radius:999px;background:#172033}.mobile-nav-menu-icon{position:relative}.mobile-nav-menu-icon:before,.mobile-nav-menu-icon:after{content:'';position:absolute;left:0}.mobile-nav-menu-icon:before{top:-6px}.mobile-nav-menu-icon:after{top:6px}
        .mobile-nav-overlay-portal{position:fixed;inset:0;z-index:2147483000;padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom));display:flex;align-items:flex-start;justify-content:center;background:rgba(23,32,51,.48);pointer-events:auto!important}.mobile-nav-drawer{position:relative;z-index:2147483001;width:100%;height:calc(100dvh - max(24px,env(safe-area-inset-top)) - max(24px,env(safe-area-inset-bottom)));max-height:900px;display:grid;grid-template-rows:auto minmax(0,1fr) auto;border:1px solid #315F70;border-radius:28px;background:#172033!important;color:#FFFFFF!important;box-shadow:0 18px 60px rgba(23,32,51,.28);overflow:hidden;pointer-events:auto!important}.mobile-nav-drawer-head{min-height:72px;padding:10px 12px 10px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid rgba(255,255,255,.14);background:#172033!important}.mobile-nav-brand-logo{color:#FFFFFF!important;font-weight:750}.mobile-nav-brand-logo .brand-logo-name{color:#FFFFFF!important;font-size:21px!important}.mobile-nav-close-btn{width:48px;height:48px;border:1px solid rgba(255,255,255,.32);border-radius:50%;display:flex;align-items:center;justify-content:center;background:#234A84!important;color:#FFFFFF!important;font-size:27px;font-weight:400;line-height:1;cursor:pointer}.mobile-nav-panel{overflow-y:auto;padding:22px 22px 28px;background:#172033!important}.mobile-nav-panel .app-nav{display:grid!important;grid-template-columns:1fr!important;gap:0!important}.mobile-nav-drawer-link{min-height:54px!important;margin:0!important;padding:13px 4px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;border:0!important;border-bottom:1px solid rgba(255,255,255,.12)!important;border-radius:0!important;background:#172033!important;color:#FFFFFF!important;font-size:18px!important;font-weight:600!important;line-height:1.3!important;text-decoration:none!important;box-shadow:none!important;opacity:1!important;visibility:visible!important}.mobile-nav-drawer-link .nav-item-label{display:block!important;color:#FFFFFF!important;opacity:1!important;visibility:visible!important}.mobile-nav-drawer-link .nav-item-meta,.mobile-nav-drawer-link .nav-plan-chip,.mobile-nav-drawer-link .nav-lock-icon{color:#FFFFFF!important;opacity:1!important}.mobile-nav-drawer-link:hover,.mobile-nav-drawer-link:focus-visible{background:#1E3F72!important;color:#FFFFFF!important}.mobile-nav-drawer-link.active,.mobile-nav-drawer-link[aria-current='page']{padding-left:14px!important;border-bottom-color:#4F7CC4!important;border-radius:12px!important;background:#234A84!important;color:#FFFFFF!important}.mobile-nav-drawer-link.active .nav-item-label,.mobile-nav-drawer-link[aria-current='page'] .nav-item-label{color:#FFFFFF!important}.mobile-nav-drawer-footer{display:grid;grid-template-columns:1fr 1fr;align-items:end;gap:10px;padding:16px 22px max(20px,env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.14);background:#1E3F72!important;color:#FFFFFF!important}.mobile-nav-drawer-footer label,.mobile-nav-drawer-footer span{color:#FFFFFF!important}.mobile-nav-drawer-footer select{width:100%;min-height:46px;border:1px solid #DDE6F2;border-radius:13px;background:#FFFFFF!important;color:#172033!important}.mobile-nav-logout{grid-column:1/-1;min-height:50px;padding:0 18px;border:1px solid #FFFFFF;border-radius:999px;background:#FFFFFF!important;color:#234A84!important;font:inherit;font-weight:750;cursor:pointer}body.mobile-nav-open{overflow:hidden}
        @media(max-width:760px){.mobile-nav-bar{min-height:62px}.mobile-nav-top-logo .brand-logo-name{font-size:17px!important}.mobile-nav-search-btn{width:42px;height:42px}.mobile-nav-menu-btn{width:44px;height:44px}}
        @media(min-width:700px){.mobile-nav-overlay-portal{justify-content:flex-end}.mobile-nav-drawer{width:min(420px,calc(100vw - 32px));height:calc(100dvh - 32px)}.mobile-nav-panel{padding-left:26px;padding-right:26px}.mobile-nav-drawer-footer{padding-left:26px;padding-right:26px}}
        @media(max-width:380px){.mobile-nav-top-logo .brand-logo-name{font-size:15px!important}.mobile-nav-bar{padding-left:10px}.mobile-nav-actions{gap:5px}}
      `}</style>
    </header>
  );
}
