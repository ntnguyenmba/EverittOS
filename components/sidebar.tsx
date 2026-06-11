'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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

type SidebarProps = {
  plan?: EverittosPlan | string | null;
  role?: UserRole | string | null;
};

export function Sidebar({ plan = 'free', role: roleProp }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const normalized = normalizePlan(plan);
  const t = useTranslations('nav');
  const commonT = useTranslations('common');
  const planName = useTranslatedPlanName();
  const [unread, setUnread] = useState(0);
  const [role, setRole] = useState<UserRole>(normalizeRole(roleProp));

  useEffect(() => {
    if (roleProp) {
      setRole(normalizeRole(roleProp));
    }
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

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function linkClass(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`) ? 'active' : undefined;
  }

  return (
    <aside className="sidebar" aria-label={t('appNavigation')}>
      <div className="sidebar-locale">
        <LocaleSwitcher compact showLabel={false} />
      </div>

      <div className="sidebar-plan">
        <span className="sidebar-plan-label">{commonT('plan')}</span>
        <span className="plan-badge">{planName(normalized)}</span>
      </div>

      {isClientRole(role) && limitsForPlan(normalized).clientPortal && (
        <Link href="/portal/client" aria-current={linkClass('/portal/client') ? 'page' : undefined}>
          {t('clientPortal')}
        </Link>
      )}
      {isContractorRole(role) && limitsForPlan(normalized).contractorPortal && (
        <Link href="/portal/contractor" aria-current={linkClass('/portal/contractor') ? 'page' : undefined}>
          {t('contractorPortal')}
        </Link>
      )}

      {!isClientRole(role) &&
        APP_NAV_LINKS.map(({ key, href }) => {
          if (!canAccessNavHref(role, href, normalized)) return null;
          return (
            <Link key={href} href={href} aria-current={linkClass(href) ? 'page' : undefined}>
              {t(key)}
              {href === '/notifications' && unread > 0 ? ` (${unread})` : ''}
            </Link>
          );
        })}

      {!isPaidEverittosPlan(normalized) && canAccessNavHref(role, '/settings/billing', normalized) && (
        <div className="sidebar-upgrade">
          <p>{t('upgradePrompt')}</p>
          <a href={EVERITTOS_STRIPE_LINKS.pro} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            {t('startPro')}
          </a>
        </div>
      )}

      <button className="btn sidebar-logout" type="button" onClick={logout}>
        {t('logout')}
      </button>
    </aside>
  );
}
