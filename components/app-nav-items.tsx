'use client';

import { usePathname } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';
import { navLabel } from '@/lib/nav-i18n';
import {
  appNavItemsForRole,
  billingUpgradeHref,
  isNavLinkActive,
  resolveNavItem
} from '@/lib/nav-access';
import {
  CLIENT_PORTAL_HOME,
  CLIENT_PORTAL_SETTINGS,
  CONTRACTOR_PORTAL_HOME,
  CONTRACTOR_PORTAL_SETTINGS
} from '@/lib/portal-access';
import { normalizePlan, planShortBadgeName, type EverittosPlan } from '@/lib/everittos-plans';
import { isClientRole, isContractorRole, normalizeRole, type UserRole } from '@/lib/roles';

type AppNavItemsProps = {
  plan: EverittosPlan;
  role: UserRole;
  unread?: number;
  linkClassName?: string;
  lockedClassName?: string;
  onNavigate?: () => void;
};

function NavLockIcon() {
  return (
    <svg className="nav-lock-icon" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17 8V7a5 5 0 0 0-10 0v1H5v12h14V8h-2zm-8 0V7a3 3 0 0 1 6 0v1H9z"
      />
    </svg>
  );
}

function navItemClassName(
  pathname: string,
  href: string,
  accessible: boolean,
  linkClassName: string,
  lockedClassName: string
): string {
  const active = isNavLinkActive(pathname, href);
  const classes = ['nav-item', linkClassName];
  if (active) classes.push('active');
  if (!accessible) classes.push(lockedClassName);
  return classes.filter(Boolean).join(' ');
}

function NavLinkRow({
  href,
  label,
  accessible,
  requiredPlan,
  pathname,
  linkClassName,
  lockedClassName,
  onNavigate
}: {
  href: string;
  label: string;
  accessible: boolean;
  requiredPlan?: EverittosPlan;
  pathname: string;
  linkClassName: string;
  lockedClassName: string;
  onNavigate?: () => void;
}) {
  const destination = accessible ? href : billingUpgradeHref(requiredPlan || 'pro', label);
  const active = isNavLinkActive(pathname, href);

  return (
    <a
      href={destination}
      className={navItemClassName(pathname, href, accessible, linkClassName, lockedClassName)}
      aria-current={active ? 'page' : undefined}
      aria-disabled={accessible ? undefined : true}
      onClick={onNavigate}
    >
      <span className="nav-item-label">{label}</span>
      {!accessible && requiredPlan ? (
        <span className="nav-item-meta">
          <NavLockIcon />
          <span className="nav-plan-chip">{planShortBadgeName(requiredPlan)}</span>
        </span>
      ) : null}
    </a>
  );
}

export function AppNavItems({
  plan,
  role,
  unread = 0,
  linkClassName = '',
  lockedClassName = 'nav-link-locked',
  onNavigate
}: AppNavItemsProps) {
  const pathname = usePathname() || '/';
  const { t } = useTranslation();
  const normalized = normalizePlan(plan);
  const normalizedRole = normalizeRole(role);

  if (isClientRole(normalizedRole)) {
    const links = [
      { label: 'Dashboard', href: CLIENT_PORTAL_HOME },
      { label: 'Appointments', href: `${CLIENT_PORTAL_HOME}?tab=jobs` },
      { label: 'Settings', href: CLIENT_PORTAL_SETTINGS }
    ];
    return (
      <nav className="app-nav" aria-label="App navigation">
        {links.map(({ label, href }) => (
          <NavLinkRow
            key={href}
            href={href}
            label={label}
            accessible
            pathname={pathname}
            linkClassName={linkClassName}
            lockedClassName={lockedClassName}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
    );
  }

  if (isContractorRole(normalizedRole)) {
    const links = [
      { label: 'Dashboard', href: CONTRACTOR_PORTAL_HOME },
      { label: 'Jobs', href: `${CONTRACTOR_PORTAL_HOME}#jobs` },
      { label: 'Schedule', href: `${CONTRACTOR_PORTAL_HOME}#schedule` },
      { label: 'Earnings', href: `${CONTRACTOR_PORTAL_HOME}#earnings` },
      { label: 'Settings', href: CONTRACTOR_PORTAL_SETTINGS }
    ];
    return (
      <nav className="app-nav" aria-label="App navigation">
        {links.map(({ label, href }) => (
          <NavLinkRow
            key={href}
            href={href}
            label={label}
            accessible={resolveNavItem(normalizedRole, normalized, href.split('#')[0]).accessible}
            pathname={pathname}
            linkClassName={linkClassName}
            lockedClassName={lockedClassName}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
    );
  }

  const items = appNavItemsForRole(normalizedRole, normalized);

  return (
    <nav className="app-nav" aria-label="App navigation">
      {items.map(({ label, href, resolution }) => (
        <NavLinkRow
          key={href}
          href={href}
          label={navLabel(href, t, label)}
          accessible={resolution.accessible}
          requiredPlan={resolution.requiredPlan}
          pathname={pathname}
          linkClassName={linkClassName}
          lockedClassName={lockedClassName}
          onNavigate={onNavigate}
        />
      ))}

      {unread > 0 ? (
        <a
          href="/notifications"
          className={`nav-item nav-item-notifications${isNavLinkActive(pathname, '/notifications') ? ' active' : ''} ${linkClassName}`}
          onClick={onNavigate}
        >
          <span className="nav-item-label">{t('nav.notifications')}</span>
          <span className="nav-unread-chip">{unread}</span>
        </a>
      ) : null}
    </nav>
  );
}
