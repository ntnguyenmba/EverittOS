'use client';

import type { ReactNode } from 'react';

type PortalClientNavProps = {
  active: 'overview' | 'appointments' | 'account';
  overviewHref: string;
  appointmentsHref: string;
  accountHref: string;
  extraActions?: ReactNode;
};

/**
 * Client portal navigation lives in the shared slide-out menu.
 * Keep this component as a no-op so existing portal pages do not need layout changes.
 * Users who own a separate business workspace still receive the full owner navigation there.
 */
export function PortalClientNav(_props: PortalClientNavProps) {
  return null;
}
