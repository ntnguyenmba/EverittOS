'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';
import { MOBILE_BOTTOM_NAV } from '@/lib/mobile-nav-config';
import { isNavLinkActive } from '@/lib/nav-access';
import { isClientRole, normalizeRole, type UserRole } from '@/lib/roles';

type MobileBottomNavProps = {
  role?: UserRole | string | null;
  onMore: () => void;
};

export function MobileBottomNav({ role, onMore }: MobileBottomNavProps) {
  const pathname = usePathname() || '/';
  const { t } = useTranslation();
  const normalizedRole = normalizeRole(role);

  if (isClientRole(normalizedRole)) return null;

  return (
    <nav className="mobile-bottom-nav" aria-label={t('ux.mobileNavLabel')}>
      {MOBILE_BOTTOM_NAV.map((item) => {
        if (item.href === '__more__') {
          return (
            <button key="more" type="button" className="mobile-bottom-nav-item" onClick={onMore}>
              <span className="mobile-bottom-nav-label">{t(item.labelKey)}</span>
            </button>
          );
        }
        const active = isNavLinkActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`mobile-bottom-nav-item${active ? ' active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className="mobile-bottom-nav-label">{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
