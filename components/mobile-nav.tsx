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
          <p className="mobile-nav-drawer-title">{t('ux.mobileNavLabel')}</p>
          <button type="button" className="mobile-nav-close-btn" aria-label={t('common.close')} onClick={() => setOpen(false)}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="mobile-nav-panel">
          <AppNavItems plan={normalized} role={role} unread={unread} linkClassName="mobile-nav-drawer-link" onNavigate={() => setOpen(false)} />
        </div>
        <div className="mobile-nav-drawer-footer">
          <div className="mobile-nav-switch-row">
            <OrgSwitcher />
            <LanguageSwitcher id="mobile-drawer-language" variant="compact" />
          </div>
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
        .mobile-nav{width:100%;border:0;background:transparent}
        .mobile-nav-bar{min-height:56px;width:100%;padding:6px 4px;display:flex;align-items:center;justify-content:space-between;gap:12px;box-sizing:border-box;border:0;border-radius:0;background:transparent;box-shadow:none}
        .mobile-nav-actions{display:flex;align-items:center;gap:8px}
        .mobile-nav-top-logo{min-width:0;display:inline-flex;align-items:center;gap:10px;color:#ffffff!important;font-weight:700;text-decoration:none}
        .mobile-nav-top-logo .brand-logo-image{display:block;border-radius:9px}
        .mobile-nav-top-logo .brand-logo-name{color:#ffffff!important;font-family:var(--font-ui),Manrope,system-ui,sans-serif!important;font-size:18px!important;line-height:1!important;white-space:nowrap}
        .mobile-nav-search-btn,.mobile-nav-menu-btn{position:relative;z-index:2147482999;width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.22);border-radius:50%;background:rgba(255,255,255,.08);color:#ffffff;box-shadow:none;cursor:pointer;pointer-events:auto!important;touch-action:manipulation}
        .mobile-nav-search-icon{position:relative;width:16px;height:16px;border:2px solid #ffffff;border-radius:50%;box-sizing:border-box}
        .mobile-nav-search-icon:after{content:'';position:absolute;width:7px;height:2px;right:-5px;bottom:-2px;border-radius:999px;background:#ffffff;transform:rotate(45deg)}
        .mobile-nav-menu-icon,.mobile-nav-menu-icon:before,.mobile-nav-menu-icon:after{display:block;width:18px;height:2px;border-radius:999px;background:#ffffff}
        .mobile-nav-menu-icon{position:relative}
        .mobile-nav-menu-icon:before,.mobile-nav-menu-icon:after{content:'';position:absolute;left:0}
        .mobile-nav-menu-icon:before{top:-6px}
        .mobile-nav-menu-icon:after{top:6px}
        .mobile-nav-overlay-portal{position:fixed;inset:0;z-index:2147483000;padding:0;display:flex;align-items:stretch;justify-content:flex-end;background:rgba(13,24,33,.46);pointer-events:auto!important}
        .mobile-nav-drawer{position:relative;z-index:2147483001;width:min(420px,100vw);height:100dvh;max-height:100dvh;display:grid;grid-template-rows:auto minmax(0,1fr) auto;border:0;border-radius:0;background:#243f53!important;color:#f4f7f9!important;box-shadow:-18px 0 40px rgba(9,24,35,.28);overflow:hidden;pointer-events:auto!important;font-family:var(--font-ui),Manrope,system-ui,sans-serif!important}
        .mobile-nav-drawer-head{min-height:64px;padding:max(14px,env(safe-area-inset-top)) 18px 12px 22px;display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid rgba(255,255,255,.12);background:#243f53!important}
        .mobile-nav-drawer-title{margin:0;color:#ffffff!important;font-size:22px!important;font-weight:500!important;letter-spacing:-0.02em;line-height:1}
        .mobile-nav-brand-logo{color:#ffffff!important;font-weight:700}
        .mobile-nav-brand-logo .brand-logo-name{color:#ffffff!important;font-size:20px!important}
        .mobile-nav-close-btn{width:44px;height:44px;border:1px solid rgba(255,255,255,.18);border-radius:10px;display:flex;align-items:center;justify-content:center;background:transparent!important;color:#ffffff!important;font-size:28px;font-weight:400;line-height:1;cursor:pointer}
        .mobile-nav-panel{overflow-y:auto;padding:6px 0 10px;background:#243f53!important}
        .mobile-nav-panel .app-nav,.mobile-nav-panel .nav-section{display:flex!important;flex-direction:column!important;gap:0!important}
        .mobile-nav-panel .nav-section-label{margin:18px 22px 4px!important;padding:0!important;color:rgba(255,255,255,.55)!important;font-size:11px!important;letter-spacing:.08em!important}
        .mobile-nav-drawer-link,.mobile-nav-drawer-link.nav-item{min-height:58px!important;margin:0!important;padding:16px 22px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;border:0!important;border-bottom:1px solid rgba(255,255,255,.12)!important;border-radius:0!important;background:transparent!important;color:#f4f7f9!important;font-family:var(--font-ui),Manrope,system-ui,sans-serif!important;font-size:18px!important;font-weight:500!important;line-height:1.3!important;text-decoration:none!important;box-shadow:none!important;opacity:1!important;visibility:visible!important}
        .mobile-nav-drawer-link .nav-item-label{display:block!important;color:#f4f7f9!important;opacity:1!important;visibility:visible!important}
        .mobile-nav-drawer-link .nav-item-meta,.mobile-nav-drawer-link .nav-lock-icon{color:rgba(244,247,249,.62)!important;opacity:1!important}
        .mobile-nav-drawer-link .nav-plan-chip{color:#d7e3ea!important;background:rgba(255,255,255,.08)!important;border:1px solid rgba(255,255,255,.14)!important}
        .mobile-nav-drawer-link:hover,.mobile-nav-drawer-link:focus-visible{background:rgba(255,255,255,.06)!important;color:#ffffff!important;border-color:rgba(255,255,255,.12)!important}
        .mobile-nav-drawer-link.active,.mobile-nav-drawer-link[aria-current='page']{padding-left:22px!important;border-color:rgba(255,255,255,.12)!important;border-radius:0!important;background:rgba(255,255,255,.08)!important;color:#ffffff!important;box-shadow:inset 3px 0 0 #ffffff!important}
        .mobile-nav-drawer-link.active .nav-item-label,.mobile-nav-drawer-link[aria-current='page'] .nav-item-label{color:#ffffff!important}
        .mobile-nav-drawer-footer{display:flex;flex-direction:column;gap:12px;padding:16px 18px max(18px,env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.12);background:#1d3343!important;color:#f4f7f9!important}
        .mobile-nav-switch-row{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,.9fr);gap:10px;align-items:stretch}
        .mobile-nav-drawer-footer .org-switcher,.mobile-nav-drawer-footer .language-switcher{display:block;width:100%;min-width:0;margin:0}
        .mobile-nav-drawer-footer .org-switcher-label,.mobile-nav-drawer-footer .language-switcher-label{display:none!important}
        .mobile-nav-drawer-footer label,.mobile-nav-drawer-footer span{color:#f4f7f9!important}
        .mobile-nav-drawer-footer select,.mobile-nav-drawer-footer .input{width:100%;min-height:46px;border:1px solid rgba(255,255,255,.16)!important;border-radius:12px!important;background:rgba(255,255,255,.08)!important;color:#ffffff!important}
        .mobile-nav-drawer-footer select option{color:#132433;background:#ffffff}
        .mobile-nav-logout{width:100%;min-height:50px;padding:0 18px;border:1px solid rgba(255,255,255,.18);border-radius:12px;background:#285d78!important;color:#ffffff!important;font:inherit;font-weight:700;cursor:pointer}
        body.mobile-nav-open{overflow:hidden}
        @media(max-width:760px){.mobile-nav-bar{min-height:52px}.mobile-nav-top-logo .brand-logo-name{font-size:17px!important}.mobile-nav-search-btn,.mobile-nav-menu-btn{width:42px;height:42px}.mobile-nav-drawer-link{font-size:17px!important;min-height:56px!important}}
        @media(min-width:700px){.mobile-nav-overlay-portal{justify-content:flex-end}.mobile-nav-drawer{width:min(400px,92vw)}}
        @media(max-width:380px){.mobile-nav-top-logo .brand-logo-name{font-size:15px!important}.mobile-nav-switch-row{grid-template-columns:1fr}.mobile-nav-drawer-link{font-size:16px!important;padding:15px 18px!important}}
      `}</style>
    </header>
  );
}
