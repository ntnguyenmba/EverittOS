'use client';

import { AppBackButton } from '@/components/app-back-button';
import { OrgSwitcher } from '@/components/org-switcher';

type AppPageTopProps = {
  role?: string | null;
  showBackButton?: boolean;
};

/** Shared top row: org switcher and back navigation. */
export function AppPageTop({ role, showBackButton = true }: AppPageTopProps) {
  return (
    <div className="app-page-top">
      <OrgSwitcher />
      {showBackButton ? <AppBackButton role={role} /> : null}
    </div>
  );
}
