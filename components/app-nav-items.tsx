'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';
import { navLabel } from '@/lib/nav-i18n';
import { appNavItemsForRole, billingUpgradeHref, isNavLinkActive, resolveNavItem } from '@/lib/nav-access';
import { CLIENT_PORTAL_HOME, CLIENT_PORTAL_SETTINGS, CONTRACTOR_PORTAL_HOME, CONTRACTOR_PORTAL_SETTINGS } from '@/lib/portal-access';
import { normalizePlan, planShortBadgeName, type EverittosPlan } from '@/lib/everittos-plans';
import { isClientRole, isContractorRole, normalizeRole, type UserRole } from '@/lib/roles';

type AppNavItemsProps = { plan: EverittosPlan; role: UserRole; unread?: number; linkClassName?: string; lockedClassName?: string; onNavigate?: () => void; excludeHrefs?: string[] };

function NavLockIcon() {
  return <svg className="nav-lock-icon" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17 8V7a5 5 0 0 0-10 0v1H5v12h14V8h-2zm-8 0V7a3 3 0 0 1 6 0v1H9z" /></svg>;
}

function navItemClassName(pathname: string, href: string, accessible: boolean, linkClassName: string, lockedClassName: string): string {
  const classes = ['nav-item', linkClassName];
  if (isNavLinkActive(pathname, href)) classes.push('active');
  if (!accessible) classes.push(lockedClassName);
  return classes.filter(Boolean).join(' ');
}

function NavLinkRow({ href, label, accessible, requiredPlan, pathname, linkClassName, lockedClassName, onNavigate }: { href: string; label: string; accessible: boolean; requiredPlan?: EverittosPlan; pathname: string; linkClassName: string; lockedClassName: string; onNavigate?: () => void }) {
  const destination = accessible ? href : billingUpgradeHref(requiredPlan || 'pro', label);
  const active = isNavLinkActive(pathname, href);
  return <Link href={destination} className={navItemClassName(pathname, href, accessible, linkClassName, lockedClassName)} aria-current={active ? 'page' : undefined} aria-disabled={accessible ? undefined : true} onClick={onNavigate}>
    <span className="nav-item-label">{label}</span>
    {!accessible && requiredPlan ? <span className="nav-item-meta"><NavLockIcon /><span className="nav-plan-chip">{planShortBadgeName(requiredPlan)}</span></span> : null}
  </Link>;
}

function isExcluded(href: string, excludeHrefs: string[]) {
  const base = href.split(/[?#]/)[0];
  return excludeHrefs.some((excluded) => base === excluded || base.startsWith(`${excluded}/`));
}

export function AppNavItems({ plan, role, unread = 0, linkClassName = '', lockedClassName = 'nav-link-locked', onNavigate, excludeHrefs = [] }: AppNavItemsProps) {
  const pathname = usePathname() || '/';
  const { t, locale } = useTranslation();
  const normalized = normalizePlan(plan);
  const normalizedRole = normalizeRole(role);
  const bookkeepingLabel = locale === 'es' ? 'Contabilidad' : locale === 'vi' ? 'Sổ sách' : 'Bookkeeping';

  if (isClientRole(normalizedRole)) {
    const links = [
      { label: t('portal.common.overview'), href: CLIENT_PORTAL_HOME },
      { label: t('portal.common.appointments'), href: `${CLIENT_PORTAL_HOME}?tab=jobs` },
      { label: t('portal.common.account'), href: CLIENT_PORTAL_SETTINGS }
    ].filter(({ href }) => !isExcluded(href, excludeHrefs));
    return <nav className="app-nav" aria-label={t('portal.common.sections')}>{links.map(({ label, href }) => <NavLinkRow key={href} href={href} label={label} accessible pathname={pathname} linkClassName={linkClassName} lockedClassName={lockedClassName} onNavigate={onNavigate} />)}</nav>;
  }

  if (isContractorRole(normalizedRole)) {
    const links = [
      { label: t('portal.contractor.nav.dashboard'), href: CONTRACTOR_PORTAL_HOME },
      { label: t('portal.contractor.nav.jobs'), href: `${CONTRACTOR_PORTAL_HOME}#current-jobs` },
      { label: t('portal.contractor.nav.earnings'), href: `${CONTRACTOR_PORTAL_HOME}#history` },
      { label: t('portal.contractor.nav.settings'), href: CONTRACTOR_PORTAL_SETTINGS }
    ].filter(({ href }) => !isExcluded(href, excludeHrefs));
    return <nav className="app-nav" aria-label={t('portal.common.sections')}>{links.map(({ label, href }) => <NavLinkRow key={href} href={href} label={label} accessible={resolveNavItem(normalizedRole, normalized, href.split('#')[0]).accessible} pathname={pathname} linkClassName={linkClassName} lockedClassName={lockedClassName} onNavigate={onNavigate} />)}</nav>;
  }

  const items = appNavItemsForRole(normalizedRole, normalized).filter(({ href }) => !isExcluded(href, excludeHrefs));
  const showBookkeeping = (normalizedRole === 'owner' || normalizedRole === 'admin' || normalizedRole === 'manager') && !isExcluded('/bookkeeping', excludeHrefs);
  const bookkeepingResolution = resolveNavItem(normalizedRole, normalized, '/bookkeeping');

  return <nav className="app-nav" aria-label={t('ux.mobileNavLabel')}>
    {items.map(({ label, href, resolution }) => <NavLinkRow key={href} href={href} label={navLabel(href, t, label, locale)} accessible={resolution.accessible} requiredPlan={resolution.requiredPlan} pathname={pathname} linkClassName={linkClassName} lockedClassName={lockedClassName} onNavigate={onNavigate} />)}
    {showBookkeeping ? <NavLinkRow href="/bookkeeping" label={bookkeepingLabel} accessible={bookkeepingResolution.accessible} requiredPlan={bookkeepingResolution.requiredPlan} pathname={pathname} linkClassName={linkClassName} lockedClassName={lockedClassName} onNavigate={onNavigate} /> : null}
    {unread > 0 && !isExcluded('/notifications', excludeHrefs) ? <Link href="/notifications" className={`nav-item nav-item-notifications${isNavLinkActive(pathname, '/notifications') ? ' active' : ''} ${linkClassName}`} onClick={onNavigate}><span className="nav-item-label">{t('nav.notifications')}</span><span className="nav-unread-chip">{unread}</span></Link> : null}
  </nav>;
}
