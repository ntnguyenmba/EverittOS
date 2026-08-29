'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { dashboardPathForRole } from '@/lib/dashboard-nav';
import { useTranslation } from '@/components/locale-provider';

type AppHomeButtonProps = {
  role?: string | null;
};

export function AppHomeButton({ role }: AppHomeButtonProps) {
  const pathname = usePathname() || '/';
  const { locale } = useTranslation();
  const href = dashboardPathForRole(role);
  const label = locale === 'es' ? 'Inicio' : locale === 'vi' ? 'Trang chủ' : 'Home';
  const pathOnly = href.split(/[?#]/)[0];
  const isHome = pathname === pathOnly;

  return (
    <Link
      href={href}
      className={`app-home-button${isHome ? ' is-current' : ''}`}
      aria-label={label}
      aria-current={isHome ? 'page' : undefined}
    >
      {label}
    </Link>
  );
}
