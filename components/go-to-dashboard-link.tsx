'use client';

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { dashboardPathForRole, loginUrlWithDashboardNext } from '@/lib/dashboard-nav';

type GoToDashboardLinkProps = {
  role?: string | null;
  /** When false, link goes to login with a safe post-auth dashboard redirect. */
  authenticated?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

export function GoToDashboardLink({
  role,
  authenticated = true,
  className,
  style,
  children
}: GoToDashboardLinkProps) {
  const href = authenticated ? dashboardPathForRole(role) : loginUrlWithDashboardNext(role);

  return (
    <Link href={href} className={className} style={style}>
      {children}
    </Link>
  );
}
