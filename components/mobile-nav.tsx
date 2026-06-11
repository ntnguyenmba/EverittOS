'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  EVERITTOS_STRIPE_LINKS,
  isPaidEverittosPlan,
  normalizePlan,
  type EverittosPlan
} from '@/lib/everittos-plans';
import { limitsForPlan } from '@/lib/everittos-limits';
import { canAccessNavHref } from '@/lib/nav-access';
import { APP_NAV_LINKS } from '@/lib/nav-links';
import { useTranslatedPlanName } from '@/lib/i18n-client';
import { isClientRole, isContractorRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { LocaleSwitcher } from '@/components/locale-switcher';

type MobileNavProps = {
  plan?: EverittosPlan | string | null;
  role?: UserRole | string | null;
};

export function MobileNav({ plan = 'free', role: roleProp }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const normalized = normalizePlan(plan);
  const t = useTranslations('nav');
  const commonT = useTranslations('common');
  const planName = useTranslatedPlanName();
  const [role, setRole] = useState<UserRole>(normalizeRole(roleProp));

  useEffect(() => {
    if (roleProp) {
      setRole(normalizeRole(roleProp));
    }
  }, [roleProp]);

  useEffect(() => {
    async function loadRole() {
      if (roleProp) return;
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      setRole(normalizeRole(profile?.role));
    }
    loadRole();
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

  const links = APP_NAV_LINKS.filter(({ href }) => canAccessNavHref(role, href, normalized));

  return (
    <div className="mobile-nav">
      <div className="mobile-nav-bar">
        <LocaleSwitcher compact showLabel={false} />
        <button
          type="button"
          className="btn mobile-nav-toggle"
          aria-expanded={open}
          aria-controls="mobile-nav-panel"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? commonT('closeMenu') : commonT('menu')}
        </button>
      </div>

      {open ? (
        <nav id="mobile-nav-panel" className="mobile-nav-panel" aria-label={t('appNavigation')}>
          <p className="mobile-nav-plan">
            {commonT('plan')}: <strong>{planName(normalized)}</strong>
          </p>
          {isClientRole(role) && limitsForPlan(normalized).clientPortal ? (
            <Link href="/portal/client" className={pathname.startsWith('/portal/client') ? 'active' : ''}>
              {t('clientPortal')}
            </Link>
          ) : null}
          {isContractorRole(role) && limitsForPlan(normalized).contractorPortal ? (
            <Link href="/portal/contractor" className={pathname.startsWith('/portal/contractor') ? 'active' : ''}>
              {t('contractorPortal')}
            </Link>
          ) : null}
          {!isClientRole(role) &&
            links.map(({ key, href }) => (
              <Link key={href} href={href} className={pathname === href || pathname.startsWith(`${href}/`) ? 'active' : ''}>
                {t(key)}
              </Link>
            ))}
          {!isPaidEverittosPlan(normalized) && canAccessNavHref(role, '/settings/billing', normalized) ? (
            <a href={EVERITTOS_STRIPE_LINKS.pro} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              {t('startPro')}
            </a>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
