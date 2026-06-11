'use client';

import { AppNavigationTracker } from '@/components/app-navigation-tracker';
import { AppPageTop } from '@/components/app-page-top';

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
        <AppPageTop role={role} />
        {children}
      </div>
    </main>
  );
}
