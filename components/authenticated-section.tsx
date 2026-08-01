'use client';

import { AppShell } from '@/components/app-shell';

type AuthenticatedSectionProps = {
  role?: string | null;
  children: React.ReactNode;
  className?: string;
};

/** Compatibility wrapper for authenticated routes that delegates shared chrome to AppShell. */
export function AuthenticatedSection({ role, children, className }: AuthenticatedSectionProps) {
  return (
    <AppShell role={role}>
      <div className={className}>{children}</div>
    </AppShell>
  );
}
