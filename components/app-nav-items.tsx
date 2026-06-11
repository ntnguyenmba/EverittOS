'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  billingUpgradeHref,
  isNavLinkActive,
  resolveNavItem
} from '@/lib/nav-access';
import { APP_NAV_LINKS } from '@/lib/nav-links';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, planDisplayName, type EverittosPlan } from '@/lib/everittos-plans';
import { isClientRole, isContractorRole, normalizeRole, type UserRole } from '@/lib/roles';

type AppNavItemsProps = {
  plan: EverittosPlan;
  role: UserRole;
  unread?: number;
  linkClassName?: string;
  lockedClassName?: string;
  onNavigate?: () => void;
};

function navItemClassName(
  pathname: string,
  href: string,
  accessible: boolean,
  linkClassName: string,
  lockedClassName: string
): string {
  const active = isNavLinkActive(pathname, href);
  const classes = [linkClassName];
  if (active) classes.push('active');
  if (!accessible) classes.push(lockedClassName);
  return classes.filter(Boolean).join(' ');
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
  const normalized = normalizePlan(plan);
  const normalizedRole = normalizeRole(role);

  const portalLinks: { label: string; href: string }[] = [];
  if (isClientRole(normalizedRole) && limitsForPlan(normalized).clientPortal) {
    portalLinks.push({ label: 'Client portal', href: '/portal/client' });
  }
  if (isContractorRole(normalizedRole) && limitsForPlan(normalized).contractorPortal) {
    portalLinks.push({ label: 'Contractor portal', href: '/portal/contractor' });
  }

  return (
    <>
      {portalLinks.map(({ label, href }) => {
        const resolution = resolveNavItem(normalizedRole, normalized, href);
        if (!resolution.visible) return null;

        const destination = resolution.accessible
          ? href
          : billingUpgradeHref(resolution.requiredPlan || 'pro', label);
        const active = isNavLinkActive(pathname, href);

        return (
          <Link
            key={href}
            href={destination}
            className={navItemClassName(pathname, href, resolution.accessible, linkClassName, lockedClassName)}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
          >
            {label}
            {!resolution.accessible && resolution.requiredPlan ? (
              <span className="nav-upgrade-badge">{planDisplayName(resolution.requiredPlan)}</span>
            ) : null}
          </Link>
        );
      })}

      {!isClientRole(normalizedRole) &&
        APP_NAV_LINKS.map(({ label, href }) => {
          const resolution = resolveNavItem(normalizedRole, normalized, href);
          if (!resolution.visible) return null;

          const destination = resolution.accessible
            ? href
            : billingUpgradeHref(resolution.requiredPlan || 'business', label);
          const active = isNavLinkActive(pathname, href);
          const suffix = href === '/notifications' && unread > 0 ? ` (${unread})` : '';

          return (
            <Link
              key={href}
              href={destination}
              className={navItemClassName(pathname, href, resolution.accessible, linkClassName, lockedClassName)}
              aria-current={active ? 'page' : undefined}
              aria-disabled={resolution.accessible ? undefined : true}
              onClick={onNavigate}
            >
              {label}
              {suffix}
              {!resolution.accessible && resolution.requiredPlan ? (
                <span className="nav-upgrade-badge">{planDisplayName(resolution.requiredPlan)}</span>
              ) : null}
            </Link>
          );
        })}
    </>
  );
}
