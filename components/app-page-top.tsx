'use client';

import { AppBackButton } from '@/components/app-back-button';

type AppPageTopProps = {
  role?: string | null;
  showBackButton?: boolean;
};

/** Shared top row for back navigation, aligned with page content. */
export function AppPageTop({ role, showBackButton = true }: AppPageTopProps) {
  if (!showBackButton) return null;

  return (
    <div className="app-page-top">
      <AppBackButton role={role} />
    </div>
  );
}
