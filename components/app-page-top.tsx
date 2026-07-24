'use client';

import { AppBackButton } from '@/components/app-back-button';
import { OrgSwitcher } from '@/components/org-switcher';

type AppPageTopProps = {
  role?: string | null;
  showBackButton?: boolean;
};

/** Shared top row for workspace switching and contextual back navigation. */
export function AppPageTop({ role, showBackButton = true }: AppPageTopProps) {
  return (
    <div className="app-page-top">
      <OrgSwitcher />
      {showBackButton ? (
        <div className="app-page-top-actions">
          <AppBackButton role={role} />
        </div>
      ) : null}
    </div>
  );
}
