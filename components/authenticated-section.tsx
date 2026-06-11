'use client';

import { AppBackButton } from '@/components/app-back-button';
import { AppNavigationTracker } from '@/components/app-navigation-tracker';

type AuthenticatedSectionProps = {
  role?: string | null;
  children: React.ReactNode;
  className?: string;
};

/** Authenticated pages that use the marketing-style section layout. */
export function AuthenticatedSection({ role, children, className }: AuthenticatedSectionProps) {
  return (
    <main className={className ? `section ${className}` : 'section'}>
      <AppNavigationTracker />
      <div className="container">
        <AppBackButton role={role} />
        {children}
      </div>
    </main>
  );
}
